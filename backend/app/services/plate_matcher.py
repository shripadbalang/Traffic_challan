"""
Matches a detected (OCR'd) plate reading against registered vehicles.

Real-world ANPR systems never assume OCR is 100% perfect — they match the
detected reading against the vehicle registry with some tolerance for small
character errors, rather than requiring an exact string match. This mirrors
that: try an exact match first (fast, common case), and if that fails, fall
back to finding the closest registered plate within a reasonable similarity
threshold.
"""
import re
import difflib
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app import models

# Minimum similarity (0-1) for a fuzzy match to be accepted. 0.75 allows
# roughly 2-3 character differences on a 10-character plate — enough to
# tolerate typical OCR mistakes without matching two genuinely different plates.
FUZZY_MATCH_CUTOFF = 0.75


def find_vehicle_by_plate(db: Session, detected_plate: str) -> Tuple[Optional[models.Vehicle], float]:
    """Returns (vehicle, match_confidence) — match_confidence is 1.0 for an
    exact match, or the similarity ratio (0-1) for a fuzzy match. Returns
    (None, 0.0) if nothing close enough was found."""
    if not detected_plate:
        return None, 0.0

    raw_plate = str(detected_plate).upper().strip()
    clean_detected = re.sub(r"[\s\-]", "", raw_plate)
    if not clean_detected:
        return None, 0.0

    # 1. Exact match on cleaned plate
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == clean_detected).first()
    if vehicle:
        return vehicle, 1.0

    # 2. Exact match on raw plate (in case plate has spaces/hyphens in DB)
    if raw_plate != clean_detected:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == raw_plate).first()
        if vehicle:
            return vehicle, 1.0

    # 3. Check all registered vehicles with clean normalization
    all_vehicles = db.query(models.Vehicle).all()
    if not all_vehicles:
        return None, 0.0

    for v in all_vehicles:
        if re.sub(r"[\s\-]", "", v.plate_number).upper() == clean_detected:
            return v, 1.0

    # 4. Fuzzy fallback — compare cleaned plates
    clean_map = {re.sub(r"[\s\-]", "", v.plate_number).upper(): v for v in all_vehicles}
    clean_plates = list(clean_map.keys())

    close_matches = difflib.get_close_matches(clean_detected, clean_plates, n=1, cutoff=FUZZY_MATCH_CUTOFF)
    if not close_matches:
        # Also try matching raw plate against raw vehicle plates
        raw_plates = [v.plate_number for v in all_vehicles]
        raw_close = difflib.get_close_matches(raw_plate, raw_plates, n=1, cutoff=FUZZY_MATCH_CUTOFF)
        if not raw_close:
            return None, 0.0
        matched_plate = raw_close[0]
        similarity = difflib.SequenceMatcher(None, raw_plate, matched_plate).ratio()
        vehicle = next(v for v in all_vehicles if v.plate_number == matched_plate)
        return vehicle, round(similarity, 3)

    matched_clean = close_matches[0]
    similarity = difflib.SequenceMatcher(None, clean_detected, matched_clean).ratio()
    vehicle = clean_map[matched_clean]
    return vehicle, round(similarity, 3)