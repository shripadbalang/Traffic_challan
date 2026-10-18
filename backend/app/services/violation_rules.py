"""
Centralized business rules for traffic violation eligibility based on vehicle type.

Business Policy:
- Helmet and Triple Riding violations are STRICTLY APPLICABLE ONLY to two-wheelers.
- Four-wheelers, heavy vehicles, three-wheelers, and unknown/unrecognized vehicle types
  CANNOT receive Helmet or Triple Riding violations.
- Wrong Side driving and general traffic offenses (speeding, mobile phone usage, red light, etc.)
  remain applicable to all vehicle classes.
"""

import re
from typing import Optional, List, Tuple, Set


# Recognized two-wheeler keywords / forms
TWO_WHEELER_KEYWORDS: Set[str] = {
    "motorcycle",
    "motorcycles",
    "motorbike",
    "motorbikes",
    "motor cycle",
    "motor bike",
    "bike",
    "bikes",
    "scooter",
    "scooters",
    "scooty",
    "moped",
    "mopeds",
    "two wheeler",
    "two-wheeler",
    "two_wheeler",
    "2 wheeler",
    "2-wheeler",
    "2_wheeler",
    "twowheeler",
    "2w",
    # Common two-wheeler models / aliases
    "activa",
    "pulsar",
    "apache",
    "splendor",
    "jupiter",
    "dio",
    "bullet",
    "vespa",
    "shine",
    "passion",
    "platina",
    "access 125",
    "access",
}

# Explicit non-two-wheeler keywords (cars, four-wheelers, heavy vehicles, three-wheelers)
NON_TWO_WHEELER_KEYWORDS: Set[str] = {
    "car",
    "cars",
    "four wheeler",
    "four-wheeler",
    "four_wheeler",
    "4 wheeler",
    "4-wheeler",
    "4_wheeler",
    "fourwheeler",
    "4w",
    "sedan",
    "suv",
    "hatchback",
    "jeep",
    "van",
    "minivan",
    "bus",
    "buses",
    "truck",
    "trucks",
    "lorry",
    "tempo",
    "dumper",
    "trailer",
    "auto",
    "rickshaw",
    "autorickshaw",
    "auto-rickshaw",
    "three wheeler",
    "three-wheeler",
    "3 wheeler",
    "3-wheeler",
    "3w",
    "heavy",
    "heavy vehicle",
    "commercial",
    "tractor",
    "tanker",
}

# Violations that are restricted ONLY to two-wheelers
TWO_WHEELER_ONLY_VIOLATIONS: Set[str] = {
    "no_helmet",
    "NO_HELMET",
    "without_helmet",
    "WITHOUT_HELMET",
    "triple_riding",
    "TRIPLE_RIDING",
}


def normalize_vehicle_type(vehicle_type: Optional[str]) -> str:
    """
    Normalizes vehicle type strings for consistent, case-insensitive comparison.
    Example: "  Four-Wheeler " -> "four-wheeler"
    """
    if not vehicle_type:
        return "unknown"
    normalized = vehicle_type.strip().lower()
    # Normalize internal separators: multiple whitespace, dashes, underscores
    normalized = re.sub(r"[\s_]+", "-", normalized).strip("-")
    return normalized or "unknown"


def is_two_wheeler(vehicle_type: Optional[str]) -> bool:
    """
    Conservatively checks if the given vehicle type is a clearly identified two-wheeler.
    Returns False for:
      - None, empty, or unknown strings
      - Generic 'vehicle' or 'standard vehicle'
      - Cars, SUVs, Jeeps, Vans, Buses, Trucks, Autos, etc.
      - Any unrecognized classification
    Only returns True if explicitly recognized as a two-wheeler (motorcycle, bike, scooter, moped, etc.).
    """
    if not vehicle_type:
        return False

    norm = normalize_vehicle_type(vehicle_type)
    if norm in ("unknown", "vehicle", "standard-vehicle", "standard", "unregistered"):
        return False

    # Normalized words and phrases (space-delimited for word boundary matching)
    spaced = norm.replace("-", " ")
    words = set(spaced.split())

    # Check non-two-wheeler keywords first to prevent false positives
    for non_kw in NON_TWO_WHEELER_KEYWORDS:
        if non_kw in spaced or non_kw.replace(" ", "-") in norm or non_kw in words:
            return False

    # Check two-wheeler keywords
    if norm in TWO_WHEELER_KEYWORDS or spaced in TWO_WHEELER_KEYWORDS:
        return True

    for kw in TWO_WHEELER_KEYWORDS:
        kw_spaced = kw.replace("-", " ")
        if kw in words or kw_spaced in spaced or kw.replace(" ", "-") in norm:
            return True

    return False


def is_violation_allowed_for_vehicle(
    vehicle_type: Optional[str],
    violation_code_or_class: str,
) -> bool:
    """
    Determines whether a violation is applicable to the specified vehicle type.
    - Two-wheelers: Allowed all violations including No Helmet and Triple Riding.
    - Four-wheelers & others: Blocked from No Helmet and Triple Riding. Wrong Side & others allowed.
    - Unknown/unmatched vehicle: Blocked from No Helmet and Triple Riding.
    """
    if not violation_code_or_class:
        return False

    v_str = violation_code_or_class.strip()
    v_norm = v_str.lower().replace("-", "_")

    # Check if this violation is restricted to two-wheelers
    is_two_wheeler_violation = (
        v_str in TWO_WHEELER_ONLY_VIOLATIONS
        or v_norm in {"no_helmet", "triple_riding", "without_helmet"}
        or "helmet" in v_norm
        or "triple" in v_norm
    )

    if is_two_wheeler_violation:
        return is_two_wheeler(vehicle_type)

    # General violations (wrong_side, speed, phone, plate, etc.) are allowed for all vehicles
    return True


def filter_eligible_violations(
    vehicle_type: Optional[str],
    violations: List[str],
) -> Tuple[List[str], List[str]]:
    """
    Filters a list of violations based on vehicle type eligibility rules.
    Returns:
        (eligible_violations, removed_violations)
    """
    eligible: List[str] = []
    removed: List[str] = []

    for v in violations:
        if is_violation_allowed_for_vehicle(vehicle_type, v):
            eligible.append(v)
        else:
            removed.append(v)

    return eligible, removed
