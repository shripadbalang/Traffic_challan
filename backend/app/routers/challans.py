from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user, require_role
from app.services.challan_engine import create_challan
from app.services.notification_service import notify_challan_created

router = APIRouter(prefix="/challans", tags=["challans"])


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

    challan = create_challan(
        db=db,
        vehicle=vehicle,
        violation_type=violation_type,
        detection_source=models.DetectionSource.manual,
        officer_id=officer_profile.id,
        location=payload.location,
    )

    if vehicle.owner:
        notify_challan_created(db, challan, vehicle.owner)

    return challan


@router.get("/my", response_model=List[schemas.ChallanOut])
def my_challans(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Citizen's own challans, across all their registered vehicles."""
    vehicle_ids = [v.id for v in user.vehicles]
    query = db.query(models.Challan).filter(models.Challan.vehicle_id.in_(vehicle_ids))
    if status:
        query = query.filter(models.Challan.status == status)
    return query.order_by(models.Challan.created_at.desc()).all()


@router.get("/{challan_id}")
def get_challan_detail(
    challan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")

    # Ownership check for citizens; officers/admins can view any
    if user.role == models.UserRole.citizen and challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this challan")

    return {
        "id": challan.id,
        "vehicle_plate": challan.vehicle.plate_number,
        "violation": challan.violation_type.name,
        "fine_amount": float(challan.fine_amount),
        "status": challan.status.value,
        "detection_source": challan.detection_source.value,
        "ai_confidence_score": challan.ai_confidence_score,
        "violation_datetime": challan.violation_datetime,
        "location": challan.location,
        "evidence": [
            {"file_path": e.file_path, "file_type": e.file_type, "annotations": e.ai_annotations_json}
            for e in challan.evidence
        ],
    }


@router.patch("/{challan_id}/dispute")
def dispute_challan(
    challan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("citizen")),
):
    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan or challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Challan not found")
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
    challan = db.query(models.Challan).filter(models.Challan.id == challan_id).first()
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    challan.status = models.ChallanStatus.pending if approve else models.ChallanStatus.cancelled
    db.commit()
    return {"message": f"Dispute resolved — challan {'reinstated' if approve else 'cancelled'}."}
