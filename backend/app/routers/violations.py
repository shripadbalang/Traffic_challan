import os
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import require_role
from app.services.ml_client import run_detection
from app.services.challan_engine import create_challan
from app.services.notification_service import notify_challan_created
from app.services.plate_matcher import find_vehicle_by_plate

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
    file: UploadFile = File(...),
    location: str = Form(None),
    latitude: float = Form(None),
    longitude: float = Form(None),
    db: Session = Depends(get_db),
    _officer=Depends(require_role("officer", "admin")),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")

    os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    saved_filename = f"{uuid.uuid4()}{ext}"
    saved_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    detection: schemas.DetectionResult = await run_detection(file_bytes, file.filename, file.content_type)

    if not detection.violations_found:
        return {
            "message": "No violations detected.",
            "plate_number": detection.plate_number,
            "evidence_path": saved_path,
        }

    if not detection.plate_number:
        return {
            "message": "Violation(s) detected but plate number could not be read. "
                       "Send to manual review.",
            "violations_found": detection.violations_found,
            "evidence_path": saved_path,
        }

    vehicle, match_confidence = find_vehicle_by_plate(db, detection.plate_number)
    if not vehicle:
        return {
            "message": f"Plate reading '{detection.plate_number}' did not match any vehicle in RTO records "
                       f"(even allowing for minor OCR errors). Cannot auto-create challan.",
            "violations_found": detection.violations_found,
            "evidence_path": saved_path,
        }

    is_exact_match = match_confidence >= 0.999

    created_challans = []
    file_type = "video" if file.content_type.startswith("video") else "image"

    for detected_class in detection.violations_found:
        code = DETECTION_CLASS_TO_VIOLATION_CODE.get(detected_class)
        if not code:
            continue

        violation_type = db.query(models.ViolationType).filter(models.ViolationType.code == code).first()
        if not violation_type:
            continue

        combined_confidence = (detection.plate_confidence or 0) * match_confidence

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

        if vehicle.owner:
            notify_challan_created(db, challan, vehicle.owner)

        created_challans.append(challan.id)

    return {
        "message": f"{len(created_challans)} challan(s) auto-created."
                   + ("" if is_exact_match else f" (matched via approximate plate reading, "
                                                  f"{match_confidence:.0%} similarity — recommend review)"),
        "violations_found": detection.violations_found,
        "plate_number_detected": detection.plate_number,
        "matched_vehicle_plate": vehicle.plate_number,
        "exact_match": is_exact_match,
        "match_confidence": round(match_confidence, 3),
        "challan_ids": created_challans,
        "evidence_path": saved_path,
    }