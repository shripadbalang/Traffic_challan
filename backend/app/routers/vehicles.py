from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import require_role

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("/lookup/{plate_number}", response_model=schemas.VehicleOut)
def lookup_vehicle(plate_number: str, db: Session = Depends(get_db)):
    """Mock Vahan lookup — simulates querying the national vehicle registry.
    Used by officers (manual entry) and internally when AI detects a plate."""
    vehicle = (
        db.query(models.Vehicle)
        .filter(models.Vehicle.plate_number == plate_number.upper())
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found in mock RTO database")

    return schemas.VehicleOut(
        id=vehicle.id,
        plate_number=vehicle.plate_number,
        vehicle_type=vehicle.vehicle_type,
        model=vehicle.model,
        rto_code=vehicle.rto_code,
        owner_name=vehicle.owner.full_name if vehicle.owner else "Unregistered / no owner on file",
    )


@router.get("/{plate_number}/history")
def vehicle_violation_history(
    plate_number: str,
    db: Session = Depends(get_db),
    _officer=Depends(require_role("officer", "admin")),
):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == plate_number.upper()).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return [
        {
            "challan_id": c.id,
            "violation": c.violation_type.name,
            "fine_amount": float(c.fine_amount),
            "status": c.status.value,
            "date": c.violation_datetime,
        }
        for c in vehicle.challans
    ]
