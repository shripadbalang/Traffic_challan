import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD",
    "DL", "DN", "GA", "GJ", "HP", "HR", "JH", "JK",
    "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN",
    "TR", "TS", "UK", "UP", "WB",
}

# Common OCR confusion maps
LETTER_TO_DIGIT = {
    "O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
    "Z": "2", "S": "5", "G": "6", "T": "7", "B": "8",
}

DIGIT_TO_LETTER = {
    "0": "D", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B",
}


@dataclass
class OpenLPRResult:
    plate_number: str
    confidence: float
    bbox: List[int]  # [x1, y1, x2, y2]
    raw_text: Optional[str] = None
    is_valid_format: bool = False


def clean_text(text: str) -> str:
    """Uppercase and retain only alphanumeric characters."""
    if not text:
        return ""
    text = text.upper()
    return re.sub(r"[^A-Z0-9]", "", text)


def normalize_plate_text(text: str) -> str:
    """
    Standardize Indian license plate patterns (e.g. MH12AB1234).
    Applies heuristic character substitutions on state codes and digits.
    """
    cleaned = clean_text(text)
    if len(cleaned) < 6:
        return cleaned

    chars = list(cleaned)

    # First two characters are state code (letters)
    for i in range(min(2, len(chars))):
        if chars[i].isdigit() and chars[i] in DIGIT_TO_LETTER:
            chars[i] = DIGIT_TO_LETTER[chars[i]]

    # Specific common state prefix OCR confusions
    prefix = "".join(chars[:2])
    if prefix in ("MM", "MI"):
        chars[0], chars[1] = "M", "H"
    elif prefix == "0D":
        chars[0], chars[1] = "O", "D"
    elif prefix == "0L":
        chars[0], chars[1] = "D", "L"

    # Positions 2 & 3 are usually district code (digits)
    if len(chars) >= 4:
        for i in range(2, 4):
            if chars[i].isalpha() and chars[i] in LETTER_TO_DIGIT:
                chars[i] = LETTER_TO_DIGIT[chars[i]]

    # Middle characters between district and number are series (letters)
    # Under CMVR rules, 'O' is not a valid series letter, 'D' is misread as 'O' or '0'
    if len(chars) >= 8:
        for i in range(4, len(chars) - 4):
            if chars[i] in ("O", "0"):
                chars[i] = "D"
            elif chars[i].isdigit() and chars[i] in DIGIT_TO_LETTER:
                chars[i] = DIGIT_TO_LETTER[chars[i]]

    # Last 4 characters are almost always digits
    if len(chars) >= 8:
        for i in range(len(chars) - 4, len(chars)):
            if chars[i].isalpha() and chars[i] in LETTER_TO_DIGIT:
                chars[i] = LETTER_TO_DIGIT[chars[i]]

    p = "".join(chars)

    # Fix 11-char artifact: XX##YYY#### -> XX##YY#### if 3rd series char is artifact
    m11 = re.fullmatch(r"^([A-Z]{2})(\d{1,2})([A-Z]{2})([A-Z0-9])(\d{4})$", p)
    if m11:
        state, dist, series, artifact, num = m11.groups()
        if state in INDIAN_STATE_CODES:
            p = f"{state}{dist}{series}{num}"

    return p


def looks_like_indian_plate(text: str) -> bool:
    """Validate whether text matches standard Indian license plate format."""
    normalized = normalize_plate_text(text)
    pattern = r"^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$"
    if re.fullmatch(pattern, normalized):
        state = normalized[:2]
        return state in INDIAN_STATE_CODES
    return False


def convert_from_qwen2vl_format(
    bbox: List[float],
    original_w: int,
    original_h: int,
) -> List[int]:
    """
    Convert normalized bounding box [x1, y1, x2, y2] in 0-1000 range
    back to original image pixel coordinates.
    """
    x1_norm, y1_norm, x2_norm, y2_norm = bbox
    x1 = round(x1_norm / 1000.0 * original_w)
    y1 = round(y1_norm / 1000.0 * original_h)
    x2 = round(x2_norm / 1000.0 * original_w)
    y2 = round(y2_norm / 1000.0 * original_h)

    x1 = max(0, min(x1, original_w))
    y1 = max(0, min(y1, original_h))
    x2 = max(0, min(x2, original_w))
    y2 = max(0, min(y2, original_h))
    return [x1, y1, x2, y2]


def parse_service_response(
    data: Dict[str, Any],
    image_w: Optional[int] = None,
    image_h: Optional[int] = None,
) -> Optional[OpenLPRResult]:
    """
    Parse JSON response from Open-LPR REST API (POST /api/v1/ocr/).
    Extracts the highest confidence plate detection with recognized OCR text.
    """
    if not isinstance(data, dict) or not data.get("success", False):
        logger.warning(f"Open-LPR service returned unsuccessful response: {data}")
        return None

    results = data.get("results", {})
    detections = results.get("detections", [])
    if not detections:
        logger.info("Open-LPR returned no detections.")
        return None

    best_result: Optional[OpenLPRResult] = None
    best_score = -1.0

    for det in detections:
        plate_info = det.get("plate", {})
        plate_conf = float(plate_info.get("confidence", 0.8))
        coords = plate_info.get("coordinates", {})
        bbox = [
            int(coords.get("x1", 0)),
            int(coords.get("y1", 0)),
            int(coords.get("x2", 0)),
            int(coords.get("y2", 0)),
        ]

        ocr_list = det.get("ocr", [])
        if not ocr_list and "text" in det:
            ocr_list = [{"text": det.get("text"), "confidence": det.get("confidence", 0.8)}]

        for ocr_item in ocr_list:
            raw_text = ocr_item.get("text", "")
            cleaned = clean_text(raw_text)
            if not cleaned:
                continue

            ocr_conf = float(ocr_item.get("confidence", 0.8))
            normalized = normalize_plate_text(cleaned)
            is_valid = looks_like_indian_plate(normalized)

            # Combined score giving preference to valid Indian plate formats
            score = (plate_conf * 0.4 + ocr_conf * 0.6) * (1.25 if is_valid else 1.0)
            if score > best_score:
                best_score = score
                best_result = OpenLPRResult(
                    plate_number=normalized,
                    confidence=min(1.0, round(float(plate_conf * ocr_conf), 3)),
                    bbox=bbox,
                    raw_text=raw_text,
                    is_valid_format=is_valid,
                )

    return best_result


def parse_vlm_json_response(
    response_text: str,
    image_w: int,
    image_h: int,
) -> Optional[OpenLPRResult]:
    """
    Parse raw VLM (Qwen-VL / OpenAI) JSON response from prompt execution.
    Extracts plate bounding boxes, OCR strings, and converts coordinates.
    """
    if not response_text:
        return None

    # Strip code block fences if present
    cleaned_json = response_text.strip()
    if "```json" in cleaned_json:
        start = cleaned_json.find("```json") + 7
        end = cleaned_json.find("```", start)
        cleaned_json = cleaned_json[start:end].strip() if end != -1 else cleaned_json[start:].strip()
    elif "```" in cleaned_json:
        start = cleaned_json.find("```") + 3
        end = cleaned_json.find("```", start)
        cleaned_json = cleaned_json[start:end].strip() if end != -1 else cleaned_json[start:].strip()

    try:
        data = json.loads(cleaned_json)
    except json.JSONDecodeError as exc:
        logger.error(f"Failed to parse JSON from VLM response: {exc}. Text: {response_text[:300]}")
        return None

    # Handle combined LPR / OCR response format
    detections = data.get("detections", [])
    if isinstance(detections, list) and detections:
        det = detections[0]
        plate_obj = det.get("plate", {})
        plate_conf = float(plate_obj.get("confidence", 0.85))
        coords = plate_obj.get("coordinates", {})
        raw_bbox = [
            float(coords.get("x1", 0)),
            float(coords.get("y1", 0)),
            float(coords.get("x2", 1000)),
            float(coords.get("y2", 1000)),
        ]
        scaled_bbox = convert_from_qwen2vl_format(raw_bbox, image_w, image_h)

        ocr_list = det.get("ocr", [])
        plate_text = ""
        ocr_conf = 0.85
        if ocr_list and isinstance(ocr_list, list):
            plate_text = ocr_list[0].get("text", "")
            ocr_conf = float(ocr_list[0].get("confidence", 0.85))
        elif "text" in data:
            plate_text = data.get("text", "")
            ocr_conf = float(data.get("confidence", 0.85))

        normalized = normalize_plate_text(plate_text)
        is_valid = looks_like_indian_plate(normalized)
        return OpenLPRResult(
            plate_number=normalized,
            confidence=min(1.0, round(plate_conf * ocr_conf, 3)),
            bbox=scaled_bbox,
            raw_text=plate_text,
            is_valid_format=is_valid,
        )

    # Handle single OCR response format
    if "text" in data:
        plate_text = data.get("text", "")
        ocr_conf = float(data.get("confidence", 0.85))
        coords = data.get("coordinates", {})
        raw_bbox = [
            float(coords.get("x1", 0)),
            float(coords.get("y1", 0)),
            float(coords.get("x2", 1000)),
            float(coords.get("y2", 1000)),
        ]
        scaled_bbox = convert_from_qwen2vl_format(raw_bbox, image_w, image_h)
        normalized = normalize_plate_text(plate_text)
        is_valid = looks_like_indian_plate(normalized)
        return OpenLPRResult(
            plate_number=normalized,
            confidence=round(ocr_conf, 3),
            bbox=scaled_bbox,
            raw_text=plate_text,
            is_valid_format=is_valid,
        )

    return None
