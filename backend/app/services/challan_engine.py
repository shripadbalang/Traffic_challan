import json
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app import models
from app.services.violation_rules import is_violation_allowed_for_vehicle

REPEAT_OFFENSE_LOOKBACK_DAYS = 365
REPEAT_OFFENSE_MULTIPLIERS = {
    0: 1.0,   # first offense
    1: 1.5,   # 2nd offense
    2: 2.0,   # 3rd offense
    3: 3.0,   # 4th+ offense
}


def get_fine_rates(db: Session) -> Dict[str, int]:
    """
    Fetch current statutory fine rates from system_settings table, falling back
    to mandated defaults:
      - Helmet: ₹500
      - Triple riding: ₹1,000
      - Wrong-side: ₹1,500
      - All three combined: ₹2,000
    """
    keys = ["fine_helmet", "fine_triple_riding", "fine_wrong_side", "fine_all_three_combined"]
    rows = db.query(models.SystemSetting).filter(models.SystemSetting.key.in_(keys)).all()
    s_map = {r.key: r.value for r in rows}

    def _to_int(val, default):
        try:
            v = int(float(val))
            return v if v >= 0 else default
        except (ValueError, TypeError):
            return default

    return {
        "fine_helmet": _to_int(s_map.get("fine_helmet"), 500),
        "fine_triple_riding": _to_int(s_map.get("fine_triple_riding"), 1000),
        "fine_wrong_side": _to_int(s_map.get("fine_wrong_side"), 1500),
        "fine_all_three_combined": _to_int(s_map.get("fine_all_three_combined"), 2000),
    }


def calculate_violation_fine(db: Session, violation_codes: List[str]) -> Tuple[float, Dict[str, Any]]:
    """
    Centrally calculate the fine amount and itemized breakdown for a list of violations.
    Fine calculation rules:
      - Helmet only: ₹500.
      - Triple riding only: ₹1,000.
      - Wrong-side only: ₹1,500.
      - Helmet + triple riding: ₹1,500.
      - Helmet + wrong-side: ₹2,000.
      - Triple riding + wrong-side: ₹2,500.
      - All three violations together: ₹2,000 as the special combined amount.
    """
    rates = get_fine_rates(db)
    clean_codes = sorted(list(set(c.strip().upper() for c in violation_codes if c and c.strip())))

    # Pre-fetch ViolationType records
    vt_rows = db.query(models.ViolationType).filter(models.ViolationType.code.in_(clean_codes)).all()
    vt_map = {vt.code: vt for vt in vt_rows}

    has_helmet = "NO_HELMET" in clean_codes
    has_triple = "TRIPLE_RIDING" in clean_codes
    has_wrong = "WRONG_SIDE_DRIVING" in clean_codes

    violations_detail = []
    normal_total = 0.0

    for code in clean_codes:
        vt = vt_map.get(code)
        name = vt.name if vt else code.replace("_", " ").title()
        if code == "NO_HELMET":
            fine = float(rates["fine_helmet"])
        elif code == "TRIPLE_RIDING":
            fine = float(rates["fine_triple_riding"])
        elif code == "WRONG_SIDE_DRIVING":
            fine = float(rates["fine_wrong_side"])
        else:
            fine = float(vt.base_fine_amount) if vt else 500.0

        normal_total += fine
        violations_detail.append({
            "code": code,
            "name": name,
            "fine": fine,
            "legal_section": vt.legal_section if vt else "Motor Vehicles Act, 1988",
        })

    is_all_three = has_helmet and has_triple and has_wrong
    if is_all_three:
        final_amount = float(rates["fine_all_three_combined"])
        discount = max(0.0, normal_total - final_amount)
        rule_applied = "all_three_special_combined"
    else:
        final_amount = normal_total
        discount = 0.0
        rule_applied = "standard_sum"

    breakdown = {
        "is_combined": len(clean_codes) > 1,
        "violations": violations_detail,
        "original_total": normal_total,
        "special_discount": discount,
        "final_amount": final_amount,
        "rule_applied": rule_applied,
    }
    return final_amount, breakdown


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
    rates = get_fine_rates(db)
    code = (violation_type.code or "").upper()
    if code == "NO_HELMET":
        base = float(rates["fine_helmet"])
    elif code == "TRIPLE_RIDING":
        base = float(rates["fine_triple_riding"])
    elif code == "WRONG_SIDE_DRIVING":
        base = float(rates["fine_wrong_side"])
    else:
        base = float(violation_type.base_fine_amount)

    prior_count = get_prior_offense_count(db, vehicle_id, violation_type.id)
    multiplier = REPEAT_OFFENSE_MULTIPLIERS.get(prior_count, REPEAT_OFFENSE_MULTIPLIERS[3])
    fine = base * multiplier
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
    notes: str = None,
) -> models.Challan:
    if not is_violation_allowed_for_vehicle(vehicle.vehicle_type, violation_type.code):
        raise ValueError(
            f"Violation '{violation_type.name}' ({violation_type.code}) is not applicable to vehicle '{vehicle.plate_number}' of type '{vehicle.vehicle_type}'."
        )

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
        notes=notes,
        violation_datetime=datetime.utcnow(),
    )
    db.add(challan)
    db.commit()
    db.refresh(challan)
    return challan


def create_combined_challan(
    db: Session,
    vehicle: models.Vehicle,
    violation_codes: List[str],
    detection_source: str,
    ai_confidence_score: float = None,
    officer_id: str = None,
    location: str = None,
    latitude: float = None,
    longitude: float = None,
) -> models.Challan:
    """
    Creates ONE combined challan for a vehicle across all detected eligible violations.
    Applies central fine calculation rules (e.g. ₹2,000 package for all 3 violations).
    """
    allowed_codes = [c for c in violation_codes if is_violation_allowed_for_vehicle(vehicle.vehicle_type, c)]
    if not allowed_codes:
        raise ValueError(f"None of the violations {violation_codes} are applicable to vehicle class '{vehicle.vehicle_type}'.")

    final_fine, breakdown = calculate_violation_fine(db, allowed_codes)

    if len(allowed_codes) == 1:
        v_type = db.query(models.ViolationType).filter(models.ViolationType.code == allowed_codes[0]).first()
    else:
        v_type = db.query(models.ViolationType).filter(models.ViolationType.code == "COMBINED_VIOLATION").first()
        if not v_type:
            v_type = models.ViolationType(
                code="COMBINED_VIOLATION",
                name="Multiple Traffic Violations (Combined)",
                base_fine_amount=2000.0,
                legal_section="Sections 128, 129, 119/177, Motor Vehicles Act 1988",
            )
            db.add(v_type)
            db.commit()
            db.refresh(v_type)

    challan = models.Challan(
        vehicle_id=vehicle.id,
        violation_type_id=v_type.id,
        officer_id=officer_id,
        detection_source=detection_source,
        fine_amount=final_fine,
        ai_confidence_score=ai_confidence_score,
        location=location,
        latitude=latitude,
        longitude=longitude,
        notes=json.dumps(breakdown),
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
