from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app import models

# Repeat-offense multiplier: if the same vehicle has N prior challans for the
# SAME violation type within the lookback window, the fine is scaled up.
# This mirrors real Motor Vehicles Act practice of escalating penalties for repeat offenses.
REPEAT_OFFENSE_LOOKBACK_DAYS = 365
REPEAT_OFFENSE_MULTIPLIERS = {
    0: 1.0,   # first offense
    1: 1.5,   # 2nd offense
    2: 2.0,   # 3rd offense
    3: 3.0,   # 4th+ offense
}


def get_prior_offense_count(db: Session, vehicle_id: str, violation_type_id: str) -> int:
    cutoff = datetime.utcnow() - timedelta(days=REPEAT_OFFENSE_LOOKBACK_DAYS)
    count = (
        db.query(models.Challan)
        .filter(
            models.Challan.vehicle_id == vehicle_id,
            models.Challan.violation_type_id == violation_type_id,
            models.Challan.violation_datetime >= cutoff,
        )
        .count()
    )
    return count


def calculate_fine(db: Session, vehicle_id: str, violation_type: models.ViolationType) -> float:
    prior_count = get_prior_offense_count(db, vehicle_id, violation_type.id)
    multiplier = REPEAT_OFFENSE_MULTIPLIERS.get(prior_count, REPEAT_OFFENSE_MULTIPLIERS[3])
    fine = float(violation_type.base_fine_amount) * multiplier
    return round(fine, 2)


def create_challan(
    db: Session,
    vehicle: models.Vehicle,
    violation_type: models.ViolationType,
    detection_source: str,
    ai_confidence_score: float = None,
    officer_id: str = None,
    location: str = None,
    latitude: float = None,
    longitude: float = None,
) -> models.Challan:
    fine_amount = calculate_fine(db, vehicle.id, violation_type)

    challan = models.Challan(
        vehicle_id=vehicle.id,
        violation_type_id=violation_type.id,
        officer_id=officer_id,
        detection_source=detection_source,
        fine_amount=fine_amount,
        ai_confidence_score=ai_confidence_score,
        location=location,
        latitude=latitude,
        longitude=longitude,
        violation_datetime=datetime.utcnow(),
    )
    db.add(challan)
    db.commit()
    db.refresh(challan)
    return challan


def calculate_risk_score(db: Session, vehicle_id: str) -> dict:
    """Simple, explainable repeat-offender risk scoring.
    score = weighted sum of (recency, frequency, severity) -> Low / Medium / High
    """
    challans = (
        db.query(models.Challan)
        .filter(models.Challan.vehicle_id == vehicle_id)
        .all()
    )
    if not challans:
        return {"score": 0, "level": "Low", "total_violations": 0}

    now = datetime.utcnow()
    score = 0.0
    for c in challans:
        days_ago = (now - c.violation_datetime).days
        recency_weight = max(0.1, 1 - (days_ago / 365))  # more recent = higher weight
        severity_weight = float(c.fine_amount) / 1000.0  # scale by fine size
        score += recency_weight * severity_weight

    score = round(score, 2)
    if score >= 5:
        level = "High"
    elif score >= 2:
        level = "Medium"
    else:
        level = "Low"

    return {"score": score, "level": level, "total_violations": len(challans)}
