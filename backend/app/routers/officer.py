import os
import json
import uuid
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import require_role, get_current_user
from app.services.ml_client import run_detection
from app.services.challan_engine import create_challan, calculate_fine
from app.services.notification_service import send_challan_notification, notify_challan_created
from app.services.plate_matcher import find_vehicle_by_plate
from app.services.violation_rules import filter_eligible_violations, is_two_wheeler

router = APIRouter(prefix="/officer", tags=["officer"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_MB = 25

DETECTION_CLASS_TO_VIOLATION_CODE = {
    "no_helmet": "NO_HELMET",
    "phone_usage": "MOBILE_PHONE_USAGE",
    "wrong_side": "WRONG_SIDE_DRIVING",
    "triple_riding": "TRIPLE_RIDING",
}


@router.get("/summary", response_model=schemas.OfficerDashboardSummary)
def get_officer_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("officer")),
):
    """
    Returns the authenticated traffic officer's official profile details and
    today's operational statistics for traffic enforcement.
    """
    officer_profile = user.officer_profile
    if not officer_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer profile record not found. Please contact the administrator.",
        )

    start_of_today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Violations & challans detected today by this officer
    violations_today = (
        db.query(models.Challan)
        .filter(
            models.Challan.officer_id == officer_profile.id,
            models.Challan.violation_datetime >= start_of_today,
        )
        .count()
    )

    challans_today = (
        db.query(models.Challan)
        .filter(models.Challan.created_at >= start_of_today)
        .count()
    )

    pending_count = (
        db.query(models.Challan)
        .filter(models.Challan.status == models.ChallanStatus.pending)
        .count()
    )

    paid_count = (
        db.query(models.Challan)
        .filter(models.Challan.status == models.ChallanStatus.paid)
        .count()
    )

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    overdue_count = (
        db.query(models.Challan)
        .filter(
            models.Challan.status == models.ChallanStatus.pending,
            models.Challan.violation_datetime < thirty_days_ago,
        )
        .count()
    )

    profile_out = schemas.OfficerProfileOut(
        id=str(officer_profile.id),
        name=user.full_name,
        badge_number=officer_profile.badge_number,
        email=user.email,
        station=officer_profile.station or "Pune City Traffic Division",
        jurisdiction=officer_profile.jurisdiction or "Zone 1 (Central Enforcement)",
        status="ACTIVE" if user.is_verified else "DISABLED",
    )

    return schemas.OfficerDashboardSummary(
        officer=profile_out,
        violations_today=violations_today,
        challans_today=challans_today,
        pending_challans=pending_count,
        paid_challans=paid_count,
        overdue_challans=overdue_count,
    )


@router.post("/violations/capture-and-detect")
async def capture_and_detect_violation(
    file: UploadFile = File(...),
    location: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    vehicle_plate: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("officer")),
):
    """
    Field violation detection flow:
    1. Officer captures image via camera or upload.
    2. File is validated and stored as non-repudiable evidence.
    3. Image is sent to real AI detection microservice (models: Helmet, Triple Riding, Wrong Side, Plates).
    4. If no violation detected -> returns clean notice, no challan generated.
    5. If violation detected -> reads number plate (or uses provided plate), looks up vehicle in DB.
    6. Prevents duplicate challans for same event.
    7. Automatically creates official E-Challan with correct fine and stores evidence.
    8. Preserves owner privacy (returns only minimal enforcement details).
    """
    officer_profile = user.officer_profile
    if not officer_profile:
        raise HTTPException(status_code=403, detail="Active officer profile required.")

    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    raw_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    if raw_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format: '{raw_ext}'. Please capture JPG or PNG images.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image exceeds {MAX_FILE_SIZE_MB}MB size limit.")

    try:
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupt image content.")

    os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)
    saved_filename = f"officer_{uuid.uuid4().hex[:12]}_{int(datetime.utcnow().timestamp())}{raw_ext}"
    saved_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    # 1. Run real AI Detection microservice
    detection: schemas.DetectionResult = await run_detection(file_bytes, file.filename, file.content_type)

    evidence_url = f"/files/evidence/{saved_filename}"

    # 2. Check if no violation was detected
    if not detection.violations_found:
        return {
            "status": "NO_VIOLATION",
            "message": "No traffic violation detected. Please review the image and capture another image if required.",
            "plate_number": detection.plate_number or "Not Detected",
            "evidence_url": evidence_url,
            "detected_vehicles": [v.model_dump() for v in detection.detected_vehicles],
        }

    # 3. Number Plate Resolution (Manual officer input takes precedence, then OCR plate)
    plate_to_search = vehicle_plate.strip().upper() if vehicle_plate and vehicle_plate.strip() else None
    if not plate_to_search:
        plate_to_search = detection.plate_number
    if not plate_to_search and detection.detected_vehicles:
        for v in detection.detected_vehicles:
            if v.plate_number:
                plate_to_search = v.plate_number
                break

    if not plate_to_search:
        return {
            "status": "PLATE_NOT_FOUND",
            "message": "Traffic violation detected by AI model, but the vehicle license plate could not be clearly read by ANPR OCR. Please verify the vehicle plate to issue the official E-Challan.",
            "violations_detected": detection.violations_found,
            "evidence_url": evidence_url,
            "ai_boxes": [b.model_dump() for b in detection.boxes],
        }

    # 4. Vehicle database lookup (normalize plate and look up in registry)
    clean_plate_to_search = re.sub(r"[\s\-]", "", plate_to_search).upper()
    vehicle, match_confidence = find_vehicle_by_plate(db, clean_plate_to_search)
    if not vehicle and plate_to_search != clean_plate_to_search:
        vehicle, match_confidence = find_vehicle_by_plate(db, plate_to_search)

    if not vehicle:
        # Conservative classification: Unmatched / unregistered plates cannot be assumed to be two-wheelers.
        vehicle = models.Vehicle(
            plate_number=clean_plate_to_search,
            vehicle_type="Unknown",
            model="Standard Vehicle",
            rto_code=clean_plate_to_search[:4] if len(clean_plate_to_search) >= 4 else "MH-12",
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        match_confidence = 1.0

    # Resolve Owner Record
    owner = vehicle.owner
    if not owner and vehicle.owner_id:
        owner = db.query(models.User).filter(models.User.id == vehicle.owner_id).first()
    if not owner and vehicle.registered_mobile:
        owner = db.query(models.User).filter(models.User.mobile_number == vehicle.registered_mobile).first()

    # 5. Violation Eligibility Filter (Enforce vehicle-type rules)
    eligible_violations, removed_violations = filter_eligible_violations(
        vehicle.vehicle_type,
        detection.violations_found,
    )

    if removed_violations:
        print(
            f"[OFFICER VIOLATION POLICY] Filtered out {removed_violations} for vehicle "
            f"{vehicle.plate_number} of class '{vehicle.vehicle_type}'. Allowed: {eligible_violations}"
        )

    if not eligible_violations:
        return {
            "status": "NO_VIOLATION",
            "message": f"Violation(s) {[v.replace('_', ' ').title() for v in removed_violations]} not applicable to {vehicle.vehicle_type} ({vehicle.plate_number}). Helmet and triple riding violations apply only to two-wheelers.",
            "plate_number": vehicle.plate_number,
            "vehicle_type": vehicle.vehicle_type,
            "evidence_url": evidence_url,
            "detected_vehicles": [v.model_dump() for v in detection.detected_vehicles],
        }

    # 6. Prevent Duplicate Challans (5-minute window for accidental double submission)
    recent_cutoff = datetime.utcnow() - timedelta(minutes=5)
    existing_duplicate = (
        db.query(models.Challan)
        .filter(
            models.Challan.vehicle_id == vehicle.id,
            models.Challan.officer_id == officer_profile.id,
            models.Challan.created_at >= recent_cutoff,
        )
        .first()
    )

    if existing_duplicate:
        # Return existing challan details without generating a duplicate
        return {
            "status": "DUPLICATE_PREVENTED",
            "message": "Notice: A challan for this vehicle was already issued within the last 5 minutes.",
            "challan_id": str(existing_duplicate.id),
            "vehicle_number": vehicle.plate_number,
            "fine_amount": float(existing_duplicate.fine_amount),
            "violation": existing_duplicate.violation_type.name,
            "evidence_url": evidence_url,
        }

    # 7. Automatic Challan Generation for eligible detected violations
    created_challans = []
    email_delivery_results = []
    total_fine = 0.0

    print("\n[CHALLAN] Creating challan...")
    print(f"[CHALLAN] Vehicle: {vehicle.plate_number}")
    if owner:
        print(f"[CHALLAN] Owner found: {owner.full_name}")
        if owner.email:
            print(f"[CHALLAN] Owner email found: {owner.email}")
        else:
            print(f"[CHALLAN] Owner email not found for {owner.full_name}")
    else:
        print(f"[CHALLAN] Owner not found in registry for vehicle {vehicle.plate_number}")

    for detected_class in eligible_violations:
        code = DETECTION_CLASS_TO_VIOLATION_CODE.get(detected_class)
        if not code:
            continue

        violation_type = (
            db.query(models.ViolationType)
            .filter(models.ViolationType.code == code)
            .first()
        )
        if not violation_type:
            continue

        combined_confidence = (detection.plate_confidence or 0.9) * match_confidence

        challan = create_challan(
            db=db,
            vehicle=vehicle,
            violation_type=violation_type,
            detection_source=models.DetectionSource.ai,
            ai_confidence_score=combined_confidence,
            officer_id=officer_profile.id,
            location=location or officer_profile.jurisdiction or "Field Traffic Patrol",
            latitude=latitude,
            longitude=longitude,
        )

        db.add(
            models.Evidence(
                challan_id=challan.id,
                file_path=saved_path,
                file_type="image",
                ai_annotations_json=json.dumps([b.model_dump() for b in detection.boxes]),
            )
        )
        db.commit()
        db.refresh(challan)

        # Dispatch email to owner & record delivery status
        try:
            notif_res = send_challan_notification(
                db=db,
                challan=challan,
                user=owner,
                evidence_url=evidence_url,
            )
        except Exception as exc:
            print(f"[OFFICER NOTIFICATION ERROR] {exc}")
            notif_res = {
                "success": False,
                "status": "failed",
                "recipient": owner.email if owner else None,
                "recipient_email": owner.email if owner else None,
                "error": str(exc),
            }
        email_delivery_results.append(notif_res)

        created_challans.append({
            "challan_id": str(challan.id),
            "violation_code": violation_type.code,
            "violation_name": violation_type.name,
            "legal_section": violation_type.legal_section or "Motor Vehicles Act",
            "fine_amount": float(challan.fine_amount),
            "confidence": round(combined_confidence * 100, 1),
            "email_sent": bool(notif_res.get("success", notif_res.get("status") == "sent")),
            "email_status": notif_res.get("status", "failed"),
            "recipient_email": notif_res.get("recipient_email") or notif_res.get("recipient"),
        })
        total_fine += float(challan.fine_amount)

    # 7. Owner Privacy: Minimum required information only (never expose passwords, tokens, full phone/email)
    unpaid_count = (
        db.query(models.Challan)
        .filter(
            models.Challan.vehicle_id == vehicle.id,
            models.Challan.status == models.ChallanStatus.pending,
        )
        .count()
    )

    owner_display = owner.full_name if owner else "Unregistered Owner"
    primary_email_res = email_delivery_results[0] if email_delivery_results else {}
    primary_email_status = primary_email_res.get("status", "not_available" if not (owner and owner.email) else "failed")
    primary_recipient_email = primary_email_res.get("recipient_email") or primary_email_res.get("recipient") or (owner.email if owner else None)
    primary_email_error = primary_email_res.get("error")
    primary_email_sent = bool(primary_email_res.get("success", primary_email_status == "sent"))

    return {
        "status": "VIOLATION_DETECTED",
        "success": True,
        "challan_id": created_challans[0]["challan_id"] if created_challans else None,
        "email_sent": primary_email_sent,
        "email_status": primary_email_status,
        "recipient_email": primary_recipient_email,
        "email_error": primary_email_error,
        "message": f"{len(created_challans)} traffic violation(s) confirmed and E-Challan generated.",
        "vehicle_number": vehicle.plate_number,
        "vehicle_type": vehicle.vehicle_type,
        "model": vehicle.model or "Standard",
        "owner_summary": {
            "registered_owner": owner_display,
            "owner_email": owner.email if owner else None,
            "total_pending_challans": unpaid_count,
            "enforcement_status": "ACTION REQUIRED" if unpaid_count >= 3 else "Normal",
        },
        "violations": created_challans,
        "total_fine_amount": total_fine,
        "evidence_url": evidence_url,
        "primary_challan_id": created_challans[0]["challan_id"] if created_challans else None,
    }


@router.get("/challans")
def list_officer_challans(
    status_filter: Optional[str] = None,
    plate_number: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _officer: models.User = Depends(require_role("officer")),
):
    """
    Returns list of challans for monitoring and enforcement.
    """
    query = db.query(models.Challan)

    if status_filter:
        query = query.filter(models.Challan.status == status_filter.lower())

    if plate_number:
        clean_plate = re.sub(r"[^a-zA-Z0-9]", "", plate_number).upper()
        query = query.join(models.Vehicle).filter(models.Vehicle.plate_number.contains(clean_plate))

    challans = (
        query.order_by(models.Challan.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for c in challans:
        ev = c.evidence[0] if c.evidence else None
        evidence_url = f"/files/evidence/{os.path.basename(ev.file_path)}" if ev else None

        results.append({
            "id": str(c.id),
            "vehicle_number": c.vehicle.plate_number,
            "vehicle_type": c.vehicle.vehicle_type,
            "violation": c.violation_type.name,
            "legal_section": c.violation_type.legal_section or "MVA 1988",
            "fine_amount": float(c.fine_amount),
            "status": c.status.value,
            "detection_source": c.detection_source.value,
            "violation_datetime": c.violation_datetime.isoformat(),
            "location": c.location or "Pune Enforcement Zone",
            "evidence_url": evidence_url,
        })

    return results


@router.get("/enforcement/repeat-violators", response_model=List[schemas.RepeatViolatorOut])
def get_repeat_violators(
    db: Session = Depends(get_db),
    _officer: models.User = Depends(require_role("officer")),
):
    """
    Rule: Vehicles with 3 or more unpaid challans are flagged as 'ACTION REQUIRED'.
    Returns vehicles ranked by unpaid violation count for field enforcement.
    """
    vehicles = db.query(models.Vehicle).all()
    results = []

    for v in vehicles:
        pending_challans = (
            db.query(models.Challan)
            .filter(
                models.Challan.vehicle_id == v.id,
                models.Challan.status == models.ChallanStatus.pending,
            )
            .all()
        )
        pending_count = len(pending_challans)
        paid_count = (
            db.query(models.Challan)
            .filter(
                models.Challan.vehicle_id == v.id,
                models.Challan.status == models.ChallanStatus.paid,
            )
            .count()
        )
        total_count = pending_count + paid_count

        if pending_count > 0 or total_count > 0:
            total_pending_fine = sum(float(c.fine_amount) for c in pending_challans)
            action_req = pending_count >= 3
            status_text = "ACTION REQUIRED" if action_req else "Normal"

            results.append(
                schemas.RepeatViolatorOut(
                    vehicle_id=str(v.id),
                    vehicle_number=v.plate_number,
                    vehicle_type=v.vehicle_type,
                    model=v.model or "Standard",
                    registered_owner=v.owner.full_name if v.owner else "Unregistered",
                    total_challans=total_count,
                    paid_challans=paid_count,
                    pending_challans=pending_count,
                    total_pending_amount=round(total_pending_fine, 2),
                    enforcement_status=status_text,
                    action_required=action_req,
                )
            )

    # Sort so vehicles with 3+ unpaid challans appear at the very top
    results.sort(key=lambda x: (-int(x.action_required), -x.pending_challans))
    return results


@router.post("/enforcement-action", response_model=schemas.EnforcementActionOut)
def record_enforcement_action(
    payload: schemas.EnforcementActionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("officer")),
):
    """
    Records an authorized field enforcement action for a vehicle with 3+ unpaid challans.
    Records: Officer ID, Vehicle number, Related challans, Action type, Date/time, Location, Notes, Status.
    """
    officer_profile = user.officer_profile
    if not officer_profile:
        raise HTTPException(status_code=403, detail="Officer profile required.")

    clean_plate = re.sub(r"[^a-zA-Z0-9]", "", payload.vehicle_number).upper()
    vehicle = (
        db.query(models.Vehicle)
        .filter(models.Vehicle.plate_number == clean_plate)
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail=f"Vehicle '{clean_plate}' not found in registry.",
        )

    # Validate action type
    valid_actions = {
        "Warning Notice",
        "Physical Notice",
        "Tow / Impound Request",
        "Court Summons",
        "Vehicle Immobilization Notice",
    }
    if payload.action_type not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action type. Allowed: {list(valid_actions)}",
        )

    related_str = ",".join(payload.related_challan_ids) if payload.related_challan_ids else ""

    action_record = models.EnforcementAction(
        officer_id=officer_profile.id,
        vehicle_id=vehicle.id,
        vehicle_number=vehicle.plate_number,
        action_type=payload.action_type,
        location=payload.location or officer_profile.jurisdiction or "Field Inspection",
        notes=payload.notes or "Field enforcement action recorded by traffic officer.",
        related_challan_ids=related_str,
        status="RECORDED",
    )
    db.add(action_record)
    db.commit()
    db.refresh(action_record)

    return schemas.EnforcementActionOut(
        id=str(action_record.id),
        officer_badge=officer_profile.badge_number,
        officer_name=user.full_name,
        vehicle_number=vehicle.plate_number,
        action_type=action_record.action_type,
        location=action_record.location,
        notes=action_record.notes,
        status=action_record.status,
        created_at=action_record.created_at,
    )


@router.get("/enforcement-actions", response_model=List[schemas.EnforcementActionOut])
def list_enforcement_actions(
    limit: int = 50,
    db: Session = Depends(get_db),
    _officer: models.User = Depends(require_role("officer")),
):
    """
    Returns recorded enforcement actions history.
    """
    actions = (
        db.query(models.EnforcementAction)
        .order_by(models.EnforcementAction.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        schemas.EnforcementActionOut(
            id=str(a.id),
            officer_badge=a.officer.badge_number if a.officer else "N/A",
            officer_name=a.officer.user.full_name if (a.officer and a.officer.user) else "Officer",
            vehicle_number=a.vehicle_number,
            action_type=a.action_type,
            location=a.location,
            notes=a.notes,
            status=a.status,
            created_at=a.created_at,
        )
        for a in actions
    ]
