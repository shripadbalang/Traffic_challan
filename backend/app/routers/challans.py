import os
import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import get_current_user, require_role
from app.services.challan_engine import create_challan
from app.services.notification_service import send_challan_notification, notify_challan_created
from app.services.violation_rules import is_violation_allowed_for_vehicle

router = APIRouter(prefix="/challans", tags=["challans"])


def is_valid_uuid(val: str) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@router.post("/manual", response_model=schemas.ChallanOut)
def create_manual_challan(
    payload: schemas.ChallanCreateManual,
    db: Session = Depends(get_db),
    officer: models.User = Depends(require_role("officer")),
):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == payload.plate_number.upper()).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found in RTO records")

    violation_type = db.query(models.ViolationType).filter(models.ViolationType.code == payload.violation_code).first()
    if not violation_type:
        raise HTTPException(status_code=404, detail="Unknown violation code")

    officer_profile = db.query(models.Officer).filter(models.Officer.user_id == officer.id).first()
    if not officer_profile:
        raise HTTPException(status_code=400, detail="Officer profile not found for this account")

    if not is_violation_allowed_for_vehicle(vehicle.vehicle_type, violation_type.code):
        raise HTTPException(
            status_code=400,
            detail=f"Violation '{violation_type.name}' ({violation_type.code}) is not applicable to vehicle class '{vehicle.vehicle_type}'. Helmet and triple riding violations apply only to two-wheelers.",
        )

    challan = create_challan(
        db=db,
        vehicle=vehicle,
        violation_type=violation_type,
        detection_source=models.DetectionSource.manual,
        officer_id=officer_profile.id,
        location=payload.location,
    )

    owner = vehicle.owner
    if not owner and vehicle.owner_id:
        owner = db.query(models.User).filter(models.User.id == vehicle.owner_id).first()
    if not owner and vehicle.registered_mobile:
        owner = db.query(models.User).filter(models.User.mobile_number == vehicle.registered_mobile).first()

    notif_res = None
    try:
        notif_res = send_challan_notification(db, challan, owner)
    except Exception as exc:
        print(f"[CHALLAN EMAIL WARNING] Could not dispatch challan notification email: {exc}")

    out = schemas.ChallanOut.model_validate(challan)
    if notif_res:
        out.email_sent = bool(notif_res.get("success", notif_res.get("status") == "sent"))
        out.email_status = notif_res.get("status")
        out.recipient_email = notif_res.get("recipient_email") or notif_res.get("recipient")
        out.email_error = notif_res.get("error")

    return out


@router.get("/my")
def my_challans(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Citizen's own challans, strictly scoped to their registered vehicles."""
    vehicle_ids = [v.id for v in user.vehicles]
    if not vehicle_ids:
        return []
    query = db.query(models.Challan).filter(models.Challan.vehicle_id.in_(vehicle_ids))
    if status and status.upper() != "ALL":
        query = query.filter(models.Challan.status == status.lower())
    challans = query.order_by(models.Challan.created_at.desc()).all()

    result = []
    for c in challans:
        has_real_file = False
        evidence_item = None
        if c.evidence:
            for ev in c.evidence:
                full_path = ev.file_path
                if os.path.isabs(full_path) and os.path.isfile(full_path):
                    has_real_file = True
                    evidence_item = ev
                    break
                rel_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, os.path.basename(full_path))
                if os.path.isfile(rel_path):
                    has_real_file = True
                    evidence_item = ev
                    break

        evidence_url = (
            f"/files/evidence/{os.path.basename(evidence_item.file_path)}"
            if (has_real_file and evidence_item)
            else None
        )
        evidence_type = evidence_item.file_type if (has_real_file and evidence_item) else None

        payment_date = None
        if c.payment and c.payment.status == "success":
            payment_date = c.payment.paid_at

        result.append({
            "id": c.id,
            "vehicle_plate": c.vehicle.plate_number,
            "violation_name": c.violation_type.name,
            "violation_code": c.violation_type.code,
            "fine_amount": float(c.fine_amount),
            "status": c.status.value,
            "violation_datetime": c.violation_datetime.isoformat(),
            "location": c.location or "State Highway Patrol Zone",
            "payment_date": payment_date.isoformat() if payment_date else None,
            "has_evidence": has_real_file,
            "evidence_url": evidence_url,
            "evidence_type": evidence_type,
            "evidence_missing_reason": "Evidence image is currently unavailable." if not has_real_file else None,
        })
    return result


@router.get("/{challan_id}")
def get_challan_detail(
    challan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not is_valid_uuid(challan_id):
        raise HTTPException(status_code=404, detail="Challan not found")

    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")

    # Strict ownership check for citizens/owners; officers/admins can view any
    user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user_role_str in ("owner", "citizen") and challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this challan")

    has_real_file = False
    evidence_item = None
    if challan.evidence:
        for ev in challan.evidence:
            full_path = ev.file_path
            if os.path.isabs(full_path) and os.path.isfile(full_path):
                has_real_file = True
                evidence_item = ev
                break
            rel_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, os.path.basename(full_path))
            if os.path.isfile(rel_path):
                has_real_file = True
                evidence_item = ev
                break

    evidence_url = (
        f"/files/evidence/{os.path.basename(evidence_item.file_path)}"
        if (has_real_file and evidence_item)
        else None
    )
    evidence_type = evidence_item.file_type if (has_real_file and evidence_item) else None

    payment_date = None
    if challan.payment and challan.payment.status == "success":
        payment_date = challan.payment.paid_at

    return {
        "id": challan.id,
        "vehicle_plate": challan.vehicle.plate_number,
        "violation": challan.violation_type.name,
        "violation_code": challan.violation_type.code,
        "fine_amount": float(challan.fine_amount),
        "status": challan.status.value,
        "detection_source": challan.detection_source.value,
        "ai_confidence_score": challan.ai_confidence_score,
        "violation_datetime": challan.violation_datetime.isoformat(),
        "location": challan.location or "State Highway Patrol Zone",
        "payment_date": payment_date.isoformat() if payment_date else None,
        "has_evidence": has_real_file,
        "evidence_url": evidence_url,
        "evidence_type": evidence_type,
        "evidence_missing_reason": "Evidence image is currently unavailable." if not has_real_file else None,
        "evidence": [
            {
                "file_path": e.file_path,
                "file_type": e.file_type,
                "annotations": e.ai_annotations_json,
                "exists": (
                    os.path.isfile(e.file_path)
                    or os.path.isfile(os.path.join(settings.EVIDENCE_STORAGE_PATH, os.path.basename(e.file_path)))
                ),
            }
            for e in challan.evidence
        ],
    }


@router.patch("/{challan_id}/dispute")
def dispute_challan(
    challan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("citizen")),
):
    if not is_valid_uuid(challan_id):
        raise HTTPException(status_code=404, detail="Challan not found")

    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan or challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Challan not found")
    if challan.status != models.ChallanStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot dispute a challan with status '{challan.status.value}'. Only pending challans can be disputed.",
        )
    challan.status = models.ChallanStatus.disputed
    db.commit()
    return {"message": "Challan marked as disputed. An admin will review it."}


@router.patch("/{challan_id}/resolve")
def resolve_dispute(
    challan_id: str,
    approve: bool,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_role("admin")),
):
    if not is_valid_uuid(challan_id):
        raise HTTPException(status_code=404, detail="Challan not found")

    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    if challan.status != models.ChallanStatus.disputed:
        raise HTTPException(status_code=400, detail="Only disputed challans can be resolved.")
    challan.status = models.ChallanStatus.pending if approve else models.ChallanStatus.cancelled
    db.commit()
    return {"message": f"Dispute resolved — challan {'reinstated' if approve else 'cancelled'}."}
