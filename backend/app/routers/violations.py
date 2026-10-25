import os
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import require_role
from app.services.ml_client import run_detection
from app.services.challan_engine import create_challan
from app.services.notification_service import (
    send_challan_notification,
    notify_challan_created,
    dispatch_challan_notifications_background,
)
from app.services.plate_matcher import find_vehicle_by_plate
from app.services.violation_rules import filter_eligible_violations

router = APIRouter(prefix="/violations", tags=["violations"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "video/mp4", "video/avi", "video/quicktime"}
MAX_FILE_SIZE_MB = 100

DETECTION_CLASS_TO_VIOLATION_CODE = {
    "no_helmet": "NO_HELMET",
    "phone_usage": "MOBILE_PHONE_USAGE",
    "wrong_side": "WRONG_SIDE_DRIVING",
    "triple_riding": "TRIPLE_RIDING",
}


@router.post("/detect")
async def detect_violation(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    location: str = Form(None),
    latitude: float = Form(None),
    longitude: float = Form(None),
    db: Session = Depends(get_db),
    _officer=Depends(require_role("officer", "admin")),
):
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".mp4", ".avi", ".mov"}
    raw_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    if raw_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: '{raw_ext}'")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

    if file.content_type.startswith("image/"):
        try:
            import io
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid or corrupt image content")

    os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)
    saved_filename = f"{uuid.uuid4()}{raw_ext}"
    saved_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    detection: schemas.DetectionResult = await run_detection(file_bytes, file.filename, file.content_type)

    if not detection.violations_found:
        return {
            "message": "No violations detected.",
            "plate_number": detection.plate_number,
            "detected_vehicles": [v.model_dump() for v in detection.detected_vehicles],
            "evidence_path": saved_path,
        }

    # Identify violating vehicles (or fall back to single root detection)
    violating_vehicles = [v for v in detection.detected_vehicles if v.violations_found]
    if not violating_vehicles:
        violating_vehicles = [schemas.DetectedVehicle(
            vehicle_id=1,
            vehicle_type="vehicle",
            plate_number=detection.plate_number,
            plate_confidence=detection.plate_confidence,
            violations_found=detection.violations_found,
        )]

    created_challans = []
    email_delivery_results = []
    unmatched_vehicles = []
    matched_vehicle_plates = []
    file_type = "video" if file.content_type.startswith("video") else "image"

    for dv in violating_vehicles:
        if not dv.plate_number:
            unmatched_vehicles.append({
                "vehicle_id": dv.vehicle_id,
                "reason": "Plate could not be read. Send to manual review.",
                "violations": dv.violations_found,
            })
            continue

        vehicle, match_confidence = find_vehicle_by_plate(db, dv.plate_number)
        if not vehicle:
            unmatched_vehicles.append({
                "vehicle_id": dv.vehicle_id,
                "plate_number": dv.plate_number,
                "reason": f"Plate '{dv.plate_number}' did not match any vehicle in RTO records.",
                "violations": dv.violations_found,
            })
            continue

        matched_vehicle_plates.append(vehicle.plate_number)
        is_exact_match = match_confidence >= 0.999

        # Filter violations based on registered vehicle type/class
        eligible_violations, removed_violations = filter_eligible_violations(
            vehicle.vehicle_type,
            dv.violations_found,
        )
        dv.violations_found = eligible_violations

        if removed_violations:
            print(
                f"[VIOLATION POLICY] Filtered out {removed_violations} for vehicle "
                f"{vehicle.plate_number} of class '{vehicle.vehicle_type}'. Allowed: {eligible_violations}"
            )

        for detected_class in eligible_violations:
            code = DETECTION_CLASS_TO_VIOLATION_CODE.get(detected_class)
            if not code:
                continue

            violation_type = db.query(models.ViolationType).filter(models.ViolationType.code == code).first()
            if not violation_type:
                continue

            combined_confidence = (dv.plate_confidence or detection.plate_confidence or 0.9) * match_confidence

            challan = create_challan(
                db=db,
                vehicle=vehicle,
                violation_type=violation_type,
                detection_source=models.DetectionSource.ai,
                ai_confidence_score=combined_confidence,
                location=location,
                latitude=latitude,
                longitude=longitude,
            )

            db.add(models.Evidence(
                challan_id=challan.id,
                file_path=saved_path,
                file_type=file_type,
                ai_annotations_json=json.dumps([b.model_dump() for b in detection.boxes]),
            ))
            db.commit()

            created_challans.append(challan.id)

    # Dispatch notifications in background without blocking response
    if created_challans:
        background_tasks.add_task(
            dispatch_challan_notifications_background,
            created_challans,
            f"/files/evidence/{os.path.basename(saved_path)}",
        )

    if not created_challans and unmatched_vehicles:
        return {
            "message": "Violation(s) detected but could not auto-create challans for vehicles.",
            "violations_found": detection.violations_found,
            "unmatched_vehicles": unmatched_vehicles,
            "evidence_path": saved_path,
        }

    status_message = (
        f"{len(created_challans)} challan(s) auto-created across {len(matched_vehicle_plates)} vehicle(s)."
        if created_challans
        else f"0 challan(s) auto-created across {len(matched_vehicle_plates)} vehicle(s). Ineligible violations filtered out."
    )

    primary_email_status = "queued" if created_challans else "not_available"
    primary_recipient = None

    return {
        "message": status_message,
        "violations_found": detection.violations_found,
        "plate_number_detected": detection.plate_number,
        "matched_vehicle_plates": matched_vehicle_plates,
        "detected_vehicles": [v.model_dump() for v in detection.detected_vehicles],
        "challan_ids": created_challans,
        "email_status": primary_email_status,
        "recipient_email": primary_recipient,
        "email_delivery_results": email_delivery_results,
        "unmatched_vehicles": unmatched_vehicles,
        "evidence_path": saved_path,
    }