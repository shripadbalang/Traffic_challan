import os
import re
import tempfile
import time
from typing import List, Dict, Any, Optional, Tuple

import cv2
import numpy as np

from app.config import settings
from app.models_loader import (
    get_general_model,
    get_pose_model,
    get_helmet_model,
    get_wrong_side_model,
    get_plate_model,
)

_easyocr_reader = None
_open_lpr_client = None


def get_open_lpr_client():
    global _open_lpr_client
    if _open_lpr_client is None:
        from app.open_lpr import OpenLPRClient
        _open_lpr_client = OpenLPRClient(
            mode=settings.OPEN_LPR_MODE,
            api_url=settings.OPEN_LPR_API_URL,
            vlm_base_url=settings.OPEN_LPR_VLM_BASE_URL,
            vlm_api_key=settings.OPEN_LPR_VLM_API_KEY,
            vlm_model=settings.OPEN_LPR_VLM_MODEL,
            timeout=settings.OPEN_LPR_TIMEOUT,
        )
    return _open_lpr_client


# ============================================================
# EASY OCR
# ============================================================

def _get_easyocr_reader():
    global _easyocr_reader

    if _easyocr_reader is None:
        print("[ml-service] Loading EasyOCR...")

        import easyocr

        _easyocr_reader = easyocr.Reader(
            ["en"],
            gpu=True,
            verbose=False,
        )

        print("[ml-service] EasyOCR loaded.")

    return _easyocr_reader


_fastplate_ocr = None


def _get_fastplate_ocr():
    global _fastplate_ocr
    if _fastplate_ocr is None:
        try:
            from fast_plate_ocr import LicensePlateRecognizer
            _fastplate_ocr = LicensePlateRecognizer("cct-s-v2-global-model")
        except Exception as e:
            print(f"[ml-service] FastPlateOCR load failed: {e}")
    return _fastplate_ocr


# ============================================================
# TEXT CLEANING
# ============================================================

def _clean_text(text: str) -> str:
    text = text.upper()
    return re.sub(r"[^A-Z0-9]", "", text)


# ============================================================
# INDIAN STATE CODES
# ============================================================

INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD",
    "DL", "DN", "GA", "GJ", "HP", "HR", "JH", "JK",
    "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN",
    "TR", "TS", "UK", "UP", "WB",
}


# ============================================================
# INDIAN PLATE FORMAT
# ============================================================

def _looks_like_indian_plate(text: str) -> bool:
    text = _clean_text(text)

    pattern = r"^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$"

    if not re.fullmatch(pattern, text):
        return False

    return text[:2] in INDIAN_STATE_CODES


# ============================================================
# OCR CHARACTER CORRECTION
# ============================================================

def _letter_to_digit(ch: str) -> str:
    mapping = {
        "O": "0",
        "Q": "0",
        "D": "0",
        "I": "1",
        "L": "1",
        "Z": "2",
        "S": "5",
        "G": "6",
        "T": "7",
        "B": "8",
    }

    return mapping.get(ch, ch)


def _digit_to_letter(ch: str) -> str:
    mapping = {
        "0": "D",
        "1": "I",
        "2": "Z",
        "5": "S",
        "6": "G",
        "8": "B",
        "4": "A",
    }

    return mapping.get(ch, ch)


# ============================================================
# NORMALIZE OCR TEXT
# ============================================================

def _normalize_plate_text(text: str) -> str:
    """
    Normalize OCR text into standard Indian plate format.

    Example:
        MH.1O.AZ 7867
        -> MH10AZ7867

    This function only converts characters where their position
    clearly indicates a number/letter.
    """

    text = _clean_text(text)

    if not text:
        return ""

    # Common OCR state prefix confusions
    if len(text) >= 2:
        if text[:2] in ("MM", "MI"):
            text = "MH" + text[2:]
        elif text[:2] == "0D":
            text = "OD" + text[2:]
        elif text[:2] == "0L":
            text = "DL" + text[2:]

    # --------------------------------------------------------
    # Find a state code.
    # --------------------------------------------------------

    state = None
    state_position = -1

    for code in INDIAN_STATE_CODES:
        position = text.find(code)

        if position >= 0:
            state = code
            state_position = position
            break

    if state is None:
        return text

    remaining = text[state_position + 2:]

    if not remaining:
        return state

    # --------------------------------------------------------
    # District number.
    # Normally 1 or 2 digits.
    # --------------------------------------------------------

    district = ""
    index = 0

    while index < len(remaining) and len(district) < 2:
        ch = remaining[index]

        if ch.isdigit():
            district += ch

        elif ch.isalpha():
            converted = _letter_to_digit(ch)

            if converted.isdigit():
                district += converted
            else:
                break

        index += 1

    if not district:
        return state

    rest = remaining[index:]

    if not rest:
        return state + district

    # --------------------------------------------------------
    # Try normal Indian registration structure.
    #
    # STATE + DISTRICT + SERIES + NUMBER
    # --------------------------------------------------------

    for number_length in (4, 3):

        if len(rest) <= number_length:
            continue

        number_raw = rest[-number_length:]
        series_raw = rest[:-number_length]

        series = ""

        for ch in series_raw:
            if ch in ("O", "0"):
                series += "D"
            elif ch.isalpha():
                series += ch
            elif ch.isdigit():
                converted = _digit_to_letter(ch)

                if converted.isalpha():
                    series += converted

        number = ""

        for ch in number_raw:
            if ch.isdigit():
                number += ch
            elif ch.isalpha():
                converted = _letter_to_digit(ch)

                if converted.isdigit():
                    number += converted

        if len(series) == 3 and len(number) == 4:
            # Handle 3-letter series caused by rivet/screw artifact (e.g. AZO -> AZ, AZ8 -> AZ)
            trimmed_candidate = state + district + series[:2] + number
            if _looks_like_indian_plate(trimmed_candidate):
                return trimmed_candidate

        if (
            1 <= len(series) <= 2
            and 3 <= len(number) <= 4
        ):
            candidate = (
                state
                + district
                + series
                + number
            )

            if _looks_like_indian_plate(candidate):
                return candidate

    return text


# ============================================================
# PARSE OCR TEXT
# ============================================================

def _parse_plate_from_text(text: str):
    """
    Try to extract one Indian registration number from one
    reading-order OCR string.

    No arbitrary combinations are generated.
    """

    cleaned = _clean_text(text)

    if not cleaned:
        return None

    # Direct match first.
    if _looks_like_indian_plate(cleaned):
        return cleaned

    normalized = _normalize_plate_text(cleaned)

    if _looks_like_indian_plate(normalized):
        return normalized

    # --------------------------------------------------------
    # Search for an Indian state code inside the OCR text.
    # --------------------------------------------------------

    for state in INDIAN_STATE_CODES:

        start_positions = [
            match.start()
            for match in re.finditer(
                re.escape(state),
                cleaned,
            )
        ]

        for start in start_positions:

            candidate_text = cleaned[start:]

            # Normal format:
            # STATE + 1/2 digit district +
            # 1-3 series letters + 3/4 digits
            pattern = (
                r"^"
                + re.escape(state)
                + r"\d{1,2}"
                + r"[A-Z]{1,2}"
                + r"\d{4}$"
            )

            if re.fullmatch(pattern, candidate_text):
                return candidate_text

    return None


def _merge_overlapping_plates(parts: List[str]) -> Optional[str]:
    """
    Merge overlapping plate readings (e.g. ['MH14LM821', '14LM8213'] -> 'MH14LM8213').
    """
    cleaned = [_clean_text(x) for x in parts if x]
    for p1 in cleaned:
        for p2 in cleaned:
            if p1 != p2:
                for ov_len in range(len(p2) - 1, 3, -1):
                    if p1.endswith(p2[:ov_len]):
                        merged = _normalize_plate_text(p1 + p2[ov_len:])
                        if _looks_like_indian_plate(merged):
                            return merged
    return None


# ============================================================
# OCR IMAGE PREPARATION
# ============================================================

def _prepare_ocr_versions(
    crop: np.ndarray
):
    if crop is None or crop.size == 0:
        return []

    h, w = crop.shape[:2]

    # Keep the original aspect ratio.
    target_width = 1400

    scale = target_width / max(w, 1)

    target_height = max(
        int(h * scale),
        100,
    )

    enlarged = cv2.resize(
        crop,
        (target_width, target_height),
        interpolation=cv2.INTER_CUBIC,
    )

    gray = cv2.cvtColor(
        enlarged,
        cv2.COLOR_BGR2GRAY,
    )

    versions = []

    versions.append(
        ("original", enlarged)
    )

    versions.append(
        ("gray", gray)
    )

    # --------------------------------------------------------
    # CLAHE
    # --------------------------------------------------------

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )

    versions.append(
        (
            "clahe",
            clahe.apply(gray),
        )
    )

    # --------------------------------------------------------
    # OTSU
    # --------------------------------------------------------

    _, otsu = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    versions.append(
        ("otsu", otsu)
    )

    # --------------------------------------------------------
    # Adaptive threshold
    # --------------------------------------------------------

    block_size = 31

    if min(gray.shape[:2]) < 31:
        block_size = 15

    if block_size % 2 == 0:
        block_size += 1

    adaptive = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        7,
    )

    versions.append(
        ("adaptive", adaptive)
    )

    # --------------------------------------------------------
    # Sharpen
    # --------------------------------------------------------

    sharpen_kernel = np.array(
        [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0],
        ],
        dtype=np.float32,
    )

    sharpened = cv2.filter2D(
        enlarged,
        -1,
        sharpen_kernel,
    )

    versions.append(
        ("sharp", sharpened)
    )

    # --------------------------------------------------------
    # Two-line plate support.
    #
    # If the plate is relatively tall/square, OCR the
    # upper and lower portions separately.
    # --------------------------------------------------------

    aspect_ratio = w / float(max(h, 1))

    if aspect_ratio < 3.0:

        mid = enlarged.shape[0] // 2

        top = enlarged[:mid, :]
        bottom = enlarged[mid:, :]

        if top.size > 0:
            versions.append(
                ("top_line", top)
            )

        if bottom.size > 0:
            versions.append(
                ("bottom_line", bottom)
            )

    return versions


# ============================================================
# GROUP OCR BOXES INTO LINES
# ============================================================

def _group_ocr_lines(parts):
    """
    Group EasyOCR detections into visual text lines.

    This is important for rectangular and two-line plates.
    """

    if not parts:
        return []

    parts = sorted(
        parts,
        key=lambda item: item["center_y"],
    )

    lines = []

    for part in parts:

        added = False

        for line in lines:

            average_y = sum(
                item["center_y"]
                for item in line
            ) / len(line)

            average_height = sum(
                item["height"]
                for item in line
            ) / len(line)

            tolerance = max(
                average_height * 0.7,
                15,
            )

            if abs(
                part["center_y"] - average_y
            ) <= tolerance:

                line.append(part)
                added = True
                break

        if not added:
            lines.append([part])

    # Sort each line left-to-right.
    for line in lines:
        line.sort(
            key=lambda item: item["center_x"]
        )

    # Sort lines top-to-bottom.
    lines.sort(
        key=lambda line: (
            sum(
                item["center_y"]
                for item in line
            )
            / len(line)
        )
    )

    return lines


# ============================================================
# BUILD OCR READING ORDER
# ============================================================

def _build_reading_order_text(parts):
    """
    Convert EasyOCR boxes into natural reading order.

    Example:
        MH10AZ
        7867

    becomes:

        MH10AZ7867
    """

    lines = _group_ocr_lines(parts)

    if not lines:
        return ""

    text = ""

    for line in lines:

        line_text = "".join(
            item["text"]
            for item in line
        )

        text += line_text

    return text


def _ocr_plate_fastplate(
    crop: np.ndarray,
    allow_two_line: bool = True,
    allow_slot9: bool = False,
):
    """
    Run FastPlateOCR on crop (both 1-line and 2-line split).
    Returns (valid_plate, raw_candidate, confidence).
    """
    if crop is None or crop.size == 0:
        return None, None, None

    fastplate = _get_fastplate_ocr()
    if fastplate is None:
        return None, None, None

    raw_candidate = None
    try:
        fp_res = fastplate.run(crop, return_confidence=True)
        if fp_res and fp_res[0].plate:
            raw_candidate = fp_res[0].plate
            clean_raw = _clean_text(raw_candidate)

            # Slot 9 recovery: when FastPlateOCR produces a 9-char candidate
            # of the form XX##YY### (2 series letters, but only 3 digits for number),
            # an Indian plate strictly requires 4 digits. The 4th digit is in slot 9
            # where argmax predicted '_' (pad). Recover the top non-pad digit from slot 9.
            if allow_slot9 and len(clean_raw) == 9 and clean_raw[5].isalpha() and clean_raw[6:].isdigit():
                try:
                    resized = cv2.resize(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (128, 64))
                    inp = resized[None, :].astype(np.uint8)
                    onnx_out = fastplate.model.run(None, {'input': inp})
                    plate_probs = onnx_out[0][0]
                    alphabet = fastplate.config.alphabet
                    slot9_indices = np.argsort(plate_probs[9])[::-1]
                    for idx in slot9_indices:
                        ch = alphabet[idx]
                        if ch != '_' and ch.isdigit():
                            cand10 = clean_raw + ch
                            norm10 = _normalize_plate_text(cand10)
                            if _looks_like_indian_plate(norm10):
                                print(f"[ml-service] FastPlateOCR slot-9 recovered: {norm10} (from {clean_raw} + {ch})")
                                return norm10, cand10, 0.94
                            break
                except Exception as e:
                    print(f"[ml-service] Slot-9 recovery error: {e}")

            norm_fp = _normalize_plate_text(raw_candidate)
            if _looks_like_indian_plate(norm_fp):
                print(f"[ml-service] FastPlateOCR direct match: {norm_fp}")
                return norm_fp, raw_candidate, 0.95
    except Exception as e:
        print(f"[ml-service] FastPlateOCR error: {e}")

    # 2-line plate (aspect ratio: height / width > 0.35)
    if allow_two_line:
        h, w = crop.shape[:2]
        if h / max(1, w) > 0.35:
            try:
                mid_y = h // 2
                top_half = crop[:mid_y + 2, :]
                bot_half = crop[mid_y - 2:, :]

                fp_top = fastplate.run(top_half, return_confidence=True)
                fp_bot = fastplate.run(bot_half, return_confidence=True)

                txt_top = _clean_text(fp_top[0].plate) if (fp_top and fp_top[0].plate) else ""
                txt_bot = _clean_text(fp_bot[0].plate) if (fp_bot and fp_bot[0].plate) else ""

                if txt_top and txt_bot:
                    # Valid 2-line Indian plate structure:
                    # 1. Total characters must not exceed 10 (Indian registrations are <= 10 chars).
                    # 2. If top line already has State (2) + District (1-2) + Series (2) (len >= 6),
                    #    bottom line MUST be pure digits (registration number).
                    valid_2line = len(txt_top) + len(txt_bot) <= 10
                    if len(txt_top) >= 6 and not txt_bot.isdigit():
                        valid_2line = False

                    if valid_2line:
                        combined_two_line = _normalize_plate_text(txt_top + txt_bot)
                        if _looks_like_indian_plate(combined_two_line):
                            print(f"[ml-service] FastPlateOCR 2-line match: {combined_two_line}")
                            return combined_two_line, (txt_top + txt_bot), 0.92
            except Exception as e:
                print(f"[ml-service] FastPlateOCR 2-line error: {e}")

    return None, raw_candidate, None


# ============================================================
# OCR PLATE
# ============================================================

def _ocr_plate(
    crop: np.ndarray,
    skip_fastplate: bool = False,
):

    if crop is None or crop.size == 0:
        return None, None

    if not skip_fastplate:
        valid_plate, _, conf = _ocr_plate_fastplate(crop)
        if valid_plate is not None:
            return valid_plate, conf

    reader = _get_easyocr_reader()

    versions = _prepare_ocr_versions(
        crop
    )

    valid_results = []

    # ========================================================
    # RUN EASY OCR
    # ========================================================

    for version_name, image in versions:

        try:

            results = reader.readtext(
                image,
                detail=1,
                paragraph=False,
                allowlist=(
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                    "0123456789"
                ),
                text_threshold=0.35,
                low_text=0.20,
                link_threshold=0.20,
                mag_ratio=1.0,
            )

        except Exception as e:

            print(
                f"[ml-service] EasyOCR error "
                f"on {version_name}: {e}"
            )

            continue

        if not results:
            continue

        parts = []

        for item in results:

            bbox, text, confidence = item

            cleaned = _clean_text(text)

            if not cleaned:
                continue

            xs = [
                point[0]
                for point in bbox
            ]

            ys = [
                point[1]
                for point in bbox
            ]

            center_x = (
                sum(xs) / len(xs)
            )

            center_y = (
                sum(ys) / len(ys)
            )

            width = max(xs) - min(xs)
            height = max(ys) - min(ys)

            parts.append(
                {
                    "text": cleaned,
                    "confidence": float(
                        confidence
                    ),
                    "center_x": center_x,
                    "center_y": center_y,
                    "width": width,
                    "height": height,
                }
            )

        if not parts:
            continue

        reading_text = (
            _build_reading_order_text(
                parts
            )
        )

        if not reading_text:
            continue

        average_confidence = (
            sum(
                item["confidence"]
                for item in parts
            )
            / len(parts)
        )

        print(
            f"[ml-service] OCR "
            f"{version_name}: "
            f"{[item['text'] for item in parts]} "
            f"reading={reading_text} "
            f"confidence="
            f"{average_confidence:.3f}"
        )

        # ----------------------------------------------------
        # Try the complete reading-order text.
        # ----------------------------------------------------

        plate = _parse_plate_from_text(
            reading_text
        )

        if plate:

            valid_results.append(
                {
                    "plate": plate,
                    "confidence": (
                        average_confidence
                    ),
                    "source": version_name,
                }
            )

        # ----------------------------------------------------
        # If OCR returned multiple lines, also try each
        # complete line individually.
        #
        # This is useful for plates such as:
        #
        # MH10AZ
        # 7867
        # ----------------------------------------------------

        lines = _group_ocr_lines(parts)

        if len(lines) > 1:

            line_texts = []

            for line in lines:

                line_text = "".join(
                    item["text"]
                    for item in line
                )

                if line_text:
                    line_texts.append(
                        line_text
                    )

            # Join only the actual visual lines.
            if len(line_texts) >= 2:

                joined = "".join(
                    line_texts
                )

                plate = _parse_plate_from_text(
                    joined
                )

                if plate:

                    valid_results.append(
                        {
                            "plate": plate,
                            "confidence": (
                                average_confidence
                            ),
                            "source": (
                                version_name
                            ),
                        }
                    )

    # ========================================================
    # SELECT OCR RESULT
    # ========================================================

    if not valid_results:

        print(
            "[ml-service] EasyOCR could not "
            "produce a valid Indian plate."
        )

        return None, None

    # --------------------------------------------------------
    # Prefer higher OCR confidence.
    #
    # If the same plate appears multiple times, its repeated
    # confirmation is useful, but we do not manufacture new
    # characters or combinations.
    # --------------------------------------------------------

    grouped = {}

    for item in valid_results:

        plate = item["plate"]

        if plate not in grouped:
            grouped[plate] = []

        grouped[plate].append(
            item
        )

    best_plate = None
    best_confidence = -1.0
    best_count = -1

    for plate, items in grouped.items():

        average_confidence = (
            sum(
                item["confidence"]
                for item in items
            )
            / len(items)
        )

        count = len(items)

        print(
            f"[ml-service] Valid OCR result: "
            f"{plate} "
            f"count={count} "
            f"avg_confidence="
            f"{average_confidence:.3f}"
        )

        if (
            average_confidence > best_confidence
            or (
                average_confidence
                == best_confidence
                and count > best_count
            )
        ):

            best_plate = plate
            best_confidence = (
                average_confidence
            )
            best_count = count

    print(
        f"[ml-service] FINAL PLATE: "
        f"{best_plate}"
    )

    return (
        best_plate,
        best_confidence,
    )


# ============================================================
# IOU
# ============================================================

def _iou(
    box_a,
    box_b
) -> float:

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)

    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)

    intersection = iw * ih

    area_a = (
        max(0, ax2 - ax1)
        *
        max(0, ay2 - ay1)
    )

    area_b = (
        max(0, bx2 - bx1)
        *
        max(0, by2 - by1)
    )

    union = (
        area_a
        + area_b
        - intersection
    )

    if union <= 0:
        return 0.0

    return intersection / union


# ============================================================
# BOX CONTAINMENT & CLUSTERING
# ============================================================

def _box_containment(box_a, box_b) -> float:
    """Return intersection area divided by the minimum area of box_a and box_b."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    intersection = iw * ih

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    min_area = min(area_a, area_b)
    if min_area <= 0:
        return 0.0
    return intersection / min_area


def _cluster_plate_boxes(
    detections: List[Tuple[float, List[int]]],
    iou_thresh: float = 0.08,
) -> List[List[Tuple[float, List[int]]]]:
    """
    Group plate detection boxes into clusters representing distinct physical plates.
    Boxes with IoU >= iou_thresh or high containment belong to the same plate cluster.
    """
    clusters: List[List[Tuple[float, List[int]]]] = []
    for det in detections:
        assigned = False
        box = det[1]
        for cluster in clusters:
            for c_det in cluster:
                c_box = c_det[1]
                if _iou(box, c_box) >= iou_thresh or _box_containment(box, c_box) >= 0.30:
                    cluster.append(det)
                    assigned = True
                    break
            if assigned:
                break
        if not assigned:
            clusters.append([det])
    return clusters


def _recognize_plate_cluster(
    image: np.ndarray,
    cluster: List[Tuple[float, List[int]]],
) -> Optional[Dict[str, Any]]:
    """
    Run FastPlateOCR, within-cluster candidate merging, and EasyOCR fallback on a single plate cluster.
    Returns dict {"plate_number": str, "confidence": float, "bbox": [x1, y1, x2, y2]} or None.
    """
    if not cluster:
        return None

    cluster_sorted = sorted(cluster, key=lambda x: x[0], reverse=True)
    recognized_plate = None
    recognized_conf = None
    plate_box = None
    fp_candidates = []

    # Pass 1: Try FastPlateOCR across boxes in this cluster
    for conf, bbox in cluster_sorted:
        x1, y1, x2, y2 = bbox
        crop = image[y1:y2, x1:x2]
        valid_fp, raw_cand, fp_conf = _ocr_plate_fastplate(crop, allow_two_line=True, allow_slot9=False)
        if raw_cand:
            fp_candidates.append(raw_cand)
        if valid_fp is not None:
            print(f"[ml-service] FastPlateOCR match: {valid_fp} (bbox={bbox}, conf={fp_conf})")
            recognized_plate = valid_fp
            recognized_conf = fp_conf
            plate_box = bbox
            break

    # Pass 2: Merge overlapping FastPlate candidates within this cluster (e.g. bike_plate.jpg)
    if recognized_plate is None and fp_candidates:
        merged = _merge_overlapping_plates(fp_candidates)
        if merged and _looks_like_indian_plate(merged):
            print(f"[ml-service] FastPlateOCR merged candidate: {merged} from {fp_candidates}")
            recognized_plate = merged
            recognized_conf = 0.93
            min_x1 = min(b[1][0] for b in cluster)
            min_y1 = min(b[1][1] for b in cluster)
            max_x2 = max(b[1][2] for b in cluster)
            max_y2 = max(b[1][3] for b in cluster)
            plate_box = [min_x1, min_y1, max_x2, max_y2]

    # Pass 3: Fall back to EasyOCR for boxes in this cluster
    if recognized_plate is None:
        for conf, bbox in cluster_sorted:
            x1, y1, x2, y2 = bbox
            if (x2 - x1) < 25 or (y2 - y1) < 12:
                continue
            print(f"[ml-service] Running EasyOCR on plate: confidence={conf:.3f} bbox={bbox}")
            crop = image[y1:y2, x1:x2]
            text, ocr_c = _ocr_plate(crop, skip_fastplate=True)
            if text is not None:
                recognized_plate = text
                recognized_conf = ocr_c
                plate_box = bbox
                break

    if recognized_plate and plate_box:
        return {
            "plate_number": recognized_plate,
            "confidence": float(recognized_conf or 0.9),
            "bbox": plate_box,
        }
    return None


# ============================================================
# VEHICLE DETECTION & SPATIAL ASSOCIATION
# ============================================================

VEHICLE_CLASS_NAMES = {
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def _detect_vehicles_and_entities(image: np.ndarray) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Detect all vehicles (motorcycles, cars, buses, trucks, bicycles) and persons using a single general model forward pass.
    Returns (vehicles, motorcycles, people).
    """
    model = get_general_model()
    if model is None:
        return [], [], []

    results = model.predict(image, conf=0.25, verbose=False)
    if not results or results[0].boxes is None:
        return [], [], []

    vehicles = []
    motorcycles = []
    people = []

    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        coords = [float(x) for x in box.xyxy[0].tolist()]

        if cls_id in VEHICLE_CLASS_NAMES:
            vehicles.append({
                "class_name": VEHICLE_CLASS_NAMES[cls_id],
                "confidence": conf,
                "bbox": coords,
            })

        if cls_id == settings.MOTORCYCLE_CLASS_ID:
            motorcycles.append({
                "bbox": coords,
                "confidence": conf,
            })
        elif cls_id == settings.PERSON_CLASS_ID:
            people.append({
                "bbox": coords,
                "confidence": conf,
            })

    return vehicles, motorcycles, people


def _detect_vehicles(image: np.ndarray) -> List[Dict[str, Any]]:
    vehicles, _, _ = _detect_vehicles_and_entities(image)
    return vehicles


def _associate_vehicles_plates_violations(
    vehicles: List[Dict[str, Any]],
    plates: List[Dict[str, Any]],
    helmet_boxes: List[Dict[str, Any]],
    wrong_side_boxes: List[Dict[str, Any]],
    triple_riding_boxes: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Spatially associates detected license plates and traffic violations
    with each vehicle bounding box. Returns a list of DetectedVehicle dicts.
    """
    detected_vehicles: List[Dict[str, Any]] = []

    for v in vehicles:
        detected_vehicles.append({
            "vehicle_type": v.get("class_name", "vehicle"),
            "confidence": float(v.get("confidence", 1.0)),
            "bbox": [float(x) for x in v.get("bbox", [])],
            "plate_number": None,
            "plate_confidence": None,
            "plate_bbox": None,
            "violations_found": [],
        })

    # Associate plates to vehicles
    assigned_plate_indices = set()
    for p_idx, plate in enumerate(plates):
        p_box = plate["bbox"]
        px = (p_box[0] + p_box[2]) / 2.0
        py = (p_box[1] + p_box[3]) / 2.0

        best_veh = None
        best_score = -1.0

        for veh in detected_vehicles:
            if veh["plate_number"] is not None:
                continue
            vx1, vy1, vx2, vy2 = veh["bbox"]
            margin_x = 35.0
            margin_y = 35.0

            in_x = (vx1 - margin_x) <= px <= (vx2 + margin_x)
            in_y = (vy1 - margin_y) <= py <= (vy2 + margin_y)

            if in_x and in_y:
                cont = _box_containment(p_box, veh["bbox"])
                iou = _iou(p_box, veh["bbox"])
                score = cont * 2.0 + iou
                if score > best_score:
                    best_score = score
                    best_veh = veh

        if best_veh is not None:
            best_veh["plate_number"] = plate["plate_number"]
            best_veh["plate_confidence"] = float(plate["confidence"])
            best_veh["plate_bbox"] = [float(x) for x in plate["bbox"]]
            assigned_plate_indices.add(p_idx)

    # For plates that couldn't be associated with any detected vehicle body
    # (e.g. tight plate crops), create a virtual vehicle entry
    for p_idx, plate in enumerate(plates):
        if p_idx not in assigned_plate_indices:
            detected_vehicles.append({
                "vehicle_type": "vehicle",
                "confidence": 1.0,
                "bbox": [float(x) for x in plate["bbox"]],
                "plate_number": plate["plate_number"],
                "plate_confidence": float(plate["confidence"]),
                "plate_bbox": [float(x) for x in plate["bbox"]],
                "violations_found": [],
            })

    # Associate triple riding
    for tr in triple_riding_boxes:
        tr_box = tr.get("bbox", [])
        best_v = None
        best_iou = -1.0
        for veh in detected_vehicles:
            if veh["vehicle_type"] == "motorcycle":
                iou = _iou(tr_box, veh["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_v = veh
        if best_v is not None and "triple_riding" not in best_v["violations_found"]:
            best_v["violations_found"].append("triple_riding")

    # Associate helmet violations
    for h in helmet_boxes:
        h_box = h.get("bbox", [])
        hx = (h_box[0] + h_box[2]) / 2.0
        best_v = None
        best_dist = 999999.0
        for veh in detected_vehicles:
            if veh["vehicle_type"] == "motorcycle":
                vx1, vy1, vx2, vy2 = veh["bbox"]
                if (vx1 - 50) <= hx <= (vx2 + 50):
                    dist = abs(hx - (vx1 + vx2) / 2.0)
                    if dist < best_dist:
                        best_dist = dist
                        best_v = veh
        if best_v is not None and "no_helmet" not in best_v["violations_found"]:
            best_v["violations_found"].append("no_helmet")

    # Associate wrong side violations
    for ws in wrong_side_boxes:
        ws_box = ws.get("bbox", [])
        best_v = None
        best_iou = -1.0
        for veh in detected_vehicles:
            iou = _iou(ws_box, veh["bbox"])
            cont = _box_containment(ws_box, veh["bbox"])
            score = max(iou, cont)
            if score > best_iou and score > 0.15:
                best_iou = score
                best_v = veh
        if best_v is not None and "wrong_side" not in best_v["violations_found"]:
            best_v["violations_found"].append("wrong_side")

    # Fallback: if violations were found but not associated with any vehicle,
    # and exactly one vehicle with a plate exists, assign the violations to that vehicle
    all_violations = []
    if helmet_boxes:
        all_violations.append("no_helmet")
    if wrong_side_boxes:
        all_violations.append("wrong_side")
    if triple_riding_boxes:
        all_violations.append("triple_riding")

    vehicles_with_plates = [v for v in detected_vehicles if v["plate_number"]]
    if len(vehicles_with_plates) == 1 and all_violations:
        target_v = vehicles_with_plates[0]
        v_type = (target_v.get("vehicle_type") or "").lower()
        for viol in all_violations:
            if viol in ("no_helmet", "triple_riding") and v_type in ("car", "truck", "bus", "heavy"):
                continue
            already_assigned = any(viol in v["violations_found"] for v in detected_vehicles)
            if not already_assigned:
                target_v["violations_found"].append(viol)

    for idx, veh in enumerate(detected_vehicles, 1):
        veh["vehicle_id"] = idx

    return detected_vehicles


# ============================================================
# TRIPLE RIDING
# ============================================================

def _detect_triple_riding(
    image: np.ndarray,
    motorcycles: Optional[List[Dict[str, Any]]] = None,
    people: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:

    if motorcycles is None or people is None:
        _, motorcycles, people = _detect_vehicles_and_entities(image)

    violations = []

    for motorcycle in motorcycles:

        motorcycle_box = (
            motorcycle["bbox"]
        )

        associated_people = []

        for person in people:

            iou = _iou(
                motorcycle_box,
                person["bbox"],
            )
            cont = _box_containment(
                motorcycle_box,
                person["bbox"],
            )

            if (
                iou
                >= settings.TRIPLE_RIDING_PERSON_IOU_THRESHOLD
                or cont >= 0.25
            ):

                associated_people.append(
                    person
                )

        people_count = len(
            associated_people
        )

        print(
            f"[ml-service] "
            f"Motorcycle detected: "
            f"{motorcycle['confidence']:.3f} "
            f"| Associated people: "
            f"{people_count}"
        )

        if (
            people_count
            >= settings.TRIPLE_RIDING_MIN_PEOPLE
        ):

            violations.append(
                {
                    "class_name": (
                        "triple_riding"
                    ),
                    "confidence": (
                        motorcycle[
                            "confidence"
                        ]
                    ),
                    "bbox": (
                        motorcycle_box
                    ),
                    "people_count": (
                        people_count
                    ),
                }
            )

    return violations


# ============================================================
# WRONG SIDE DETECTION
# ============================================================

def _detect_wrong_side(
    image: np.ndarray,
    detected_vehicles: List[Dict[str, Any]],
    people: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Intelligent Wrong-Side Driving Detection:
    1. Filter out unoccupied / parked vehicles (two-wheelers require an active rider).
    2. Analyze rider orientation using YOLO11-Pose (facial keypoints: oncoming vs outgoing).
    3. Determine dominant traffic flow and detect vehicles driving against the stream.
    4. Run specialized wrong_side_model with right-side competition suppression.
    """
    if not detected_vehicles:
        return []

    gen_model = get_general_model()
    pose_model = get_pose_model()
    ws_model = get_wrong_side_model()

    # 1. Use pre-detected persons if provided, otherwise detect once
    if people is None:
        people = []
        if gen_model is not None:
            gen_res = gen_model.predict(image, conf=0.25, verbose=False)
            if gen_res and gen_res[0].boxes is not None:
                for b in gen_res[0].boxes:
                    if int(b.cls[0]) == settings.PERSON_CLASS_ID:
                        people.append({
                            "bbox": [float(x) for x in b.xyxy[0].tolist()],
                            "confidence": float(b.conf[0]),
                        })

    # Associate people to vehicles to filter for active (occupied) vehicles
    active_vehicles = []
    for veh in detected_vehicles:
        vbox = veh["bbox"]
        vtype = veh.get("class_name", "vehicle")

        if vtype in ("motorcycle", "bicycle"):
            has_rider = False
            for p in people:
                pbox = p["bbox"]
                ix1 = max(vbox[0], pbox[0])
                iy1 = max(vbox[1], pbox[1])
                ix2 = min(vbox[2], pbox[2])
                iy2 = min(vbox[3], pbox[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                a1 = (vbox[2] - vbox[0]) * (vbox[3] - vbox[1])
                a2 = (pbox[2] - pbox[0]) * (pbox[3] - pbox[1])
                iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
                cont = inter / min(a1, a2) if min(a1, a2) > 0 else 0
                if iou >= 0.08 or cont >= 0.25:
                    has_rider = True
                    break
            if has_rider:
                active_vehicles.append({**veh, "has_rider": True})
        else:
            # Four-wheelers (cars, buses, trucks)
            active_vehicles.append({**veh, "has_rider": True})

    if not active_vehicles:
        return []

    # 2. Run Pose Model to detect rider heading (ONCOMING vs OUTGOING)
    headings = []
    if pose_model is not None:
        pose_res = pose_model.predict(image, conf=0.25, verbose=False)
        if pose_res and pose_res[0].boxes is not None and len(pose_res[0].boxes) > 0 and pose_res[0].keypoints is not None:
            kp_boxes = pose_res[0].boxes
            kp_data = pose_res[0].keypoints
            num_people = len(kp_boxes)
            for av in active_vehicles:
                vbox = av["bbox"]
                av_heading = None
                for i in range(num_people):
                    pbox = kp_boxes[i].xyxy[0].tolist()
                    ix1 = max(vbox[0], pbox[0])
                    iy1 = max(vbox[1], pbox[1])
                    ix2 = min(vbox[2], pbox[2])
                    iy2 = min(vbox[3], pbox[3])
                    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                    v_area = (vbox[2] - vbox[0]) * (vbox[3] - vbox[1])
                    p_area = (pbox[2] - pbox[0]) * (pbox[3] - pbox[1])
                    min_area = min(v_area, p_area) if min(v_area, p_area) > 0 else 1.0
                    overlap = inter / min_area
                    if overlap > 0.15:
                        pts = kp_data[i].data[0].tolist()
                        face_confs = [pts[k][2] for k in range(3)]  # nose, left eye, right eye
                        is_oncoming = any(c > 0.55 for c in face_confs) or (sum(face_confs) / 3.0 > 0.35)
                        av_heading = "ONCOMING" if is_oncoming else "OUTGOING"
                        break
                av["heading"] = av_heading
                if av_heading:
                    headings.append(av_heading)

    outgoing_count = headings.count("OUTGOING")
    oncoming_count = headings.count("ONCOMING")

    # Determine dominant traffic flow direction from vehicle/rider headings
    dominant_flow = None
    if outgoing_count > oncoming_count and outgoing_count >= 1:
        dominant_flow = "OUTGOING"
    elif oncoming_count > outgoing_count and oncoming_count >= 1:
        dominant_flow = "ONCOMING"

    # 3. Run specialized wrong_side_model
    ws_boxes = []
    rs_boxes = []
    if ws_model is not None:
        conf_thr = getattr(settings, "WRONG_SIDE_CONFIDENCE_THRESHOLD", 0.40)
        ws_res = ws_model.predict(image, conf=conf_thr, verbose=False)
        if ws_res and ws_res[0].boxes is not None:
            for b in ws_res[0].boxes:
                cname = ws_model.names[int(b.cls[0])].lower()
                cconf = float(b.conf[0])
                cbox = [float(x) for x in b.xyxy[0].tolist()]
                if cname == "wrong-side":
                    ws_boxes.append({"confidence": cconf, "bbox": cbox})
                elif cname == "right-side":
                    rs_boxes.append({"confidence": cconf, "bbox": cbox})

    violations = []

    for av in active_vehicles:
        vbox = av["bbox"]
        heading = av.get("heading")

        # Case 1: Vehicle heading opposes established dominant traffic flow
        # (if dominant traffic is OUTGOING, ONCOMING is wrong-side; if dominant traffic is ONCOMING, OUTGOING is wrong-side)
        if dominant_flow == "OUTGOING" and heading == "ONCOMING":
            violations.append({
                "class_name": "wrong_side",
                "confidence": 0.88,
                "bbox": vbox,
                "reason": "Vehicle heading ONCOMING directly against dominant OUTGOING traffic stream",
            })
            continue

        if dominant_flow == "ONCOMING" and heading == "OUTGOING":
            violations.append({
                "class_name": "wrong_side",
                "confidence": 0.88,
                "bbox": vbox,
                "reason": "Vehicle heading OUTGOING directly against dominant ONCOMING traffic stream",
            })
            continue

        # Case 2: Vehicle moving with dominant traffic stream -> suppress false alarms
        if dominant_flow is not None and heading == dominant_flow:
            continue

        # Case 3: Specialized model detection with right-side competition suppression
        matched_ws = None
        for ws in ws_boxes:
            cbox = ws["bbox"]
            ix1 = max(vbox[0], cbox[0])
            iy1 = max(vbox[1], cbox[1])
            ix2 = min(vbox[2], cbox[2])
            iy2 = min(vbox[3], cbox[3])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            a1 = (vbox[2] - vbox[0]) * (vbox[3] - vbox[1])
            a2 = (cbox[2] - cbox[0]) * (cbox[3] - cbox[1])
            score = inter / min(a1, a2) if min(a1, a2) > 0 else 0
            if score > 0.25:
                matched_ws = ws
                break

        if matched_ws:
            # Check right-side competition
            matched_rs = None
            for rs in rs_boxes:
                rbox = rs["bbox"]
                ix1 = max(vbox[0], rbox[0])
                iy1 = max(vbox[1], rbox[1])
                ix2 = min(vbox[2], rbox[2])
                iy2 = min(vbox[3], rbox[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                a1 = (vbox[2] - vbox[0]) * (vbox[3] - vbox[1])
                a2 = (rbox[2] - rbox[0]) * (rbox[3] - rbox[1])
                score = inter / min(a1, a2) if min(a1, a2) > 0 else 0
                if score > 0.25 and rs["confidence"] >= matched_ws["confidence"]:
                    matched_rs = rs
                    break

            # If vehicle heading aligns with dominant flow, suppress model prediction
            if dominant_flow and heading == dominant_flow:
                continue

            if not matched_rs and (
                matched_ws["confidence"] >= 0.70
                or (dominant_flow and heading and heading != dominant_flow)
                or (heading == "ONCOMING" and dominant_flow != "ONCOMING")
            ):
                violations.append({
                    "class_name": "wrong_side",
                    "confidence": matched_ws["confidence"],
                    "bbox": vbox,
                    "reason": f"Classified as wrong-side (conf={matched_ws['confidence']:.2f})",
                })

    return violations


# ============================================================
# PROCESS IMAGE
# ============================================================

def process_image(
    file_bytes: bytes
) -> Dict[str, Any]:

    image_array = np.frombuffer(
        file_bytes,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR,
    )

    if image is None:
        try:
            import io
            from PIL import Image
            pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            pass

    if image is None:
        raise ValueError(
            "Could not decode image."
        )

    # Downscale high-resolution images to max 1280px for high-speed inference
    orig_h, orig_w = image.shape[:2]
    max_dim = 1280
    if max(orig_h, orig_w) > max_dim:
        scale_factor = max_dim / float(max(orig_h, orig_w))
        image = cv2.resize(image, (int(orig_w * scale_factor), int(orig_h * scale_factor)), interpolation=cv2.INTER_AREA)

    violations_found = []
    boxes = []

    # ========================================================
    # 1. DETECT VEHICLES & TRIPLE RIDING (SINGLE FORWARD PASS)
    # ========================================================

    detected_vehicle_boxes, motorcycles, people = _detect_vehicles_and_entities(image)
    triple_results = _detect_triple_riding(image, motorcycles=motorcycles, people=people)

    for item in triple_results:
        boxes.append(item)
        if "triple_riding" not in violations_found:
            violations_found.append("triple_riding")

    # ========================================================
    # 2. HELMET VIOLATION DETECTION
    # ========================================================

    helmet_boxes = []
    helmet_model = get_helmet_model()

    if helmet_model is not None:
        helmet_results = helmet_model.predict(
            image,
            conf=settings.CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        if helmet_results and helmet_results[0].boxes is not None:
            for box in helmet_results[0].boxes:
                cls_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = str(helmet_model.names[cls_id]).lower()
                coords = [float(x) for x in box.xyxy[0].tolist()]

                boxes.append({
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox": coords,
                })

                if class_name == settings.HELMET_VIOLATION_CLASS_NAME.lower():
                    helmet_boxes.append({
                        "class_name": class_name,
                        "confidence": confidence,
                        "bbox": coords,
                    })
                    if "no_helmet" not in violations_found:
                        violations_found.append("no_helmet")

    # ========================================================
    # 3. WRONG SIDE VIOLATION DETECTION (REUSES DETECTED PEOPLE)
    # ========================================================

    wrong_side_boxes = _detect_wrong_side(image, detected_vehicle_boxes, people=people)
    for wsb in wrong_side_boxes:
        boxes.append(wsb)
        if "wrong_side" not in violations_found:
            violations_found.append("wrong_side")

    # ========================================================
    # 4. NUMBER PLATE DETECTION & RECOGNITION
    # ========================================================

    recognized_plates = []

    # Try Open-LPR first if enabled
    if settings.OPEN_LPR_ENABLED:
        try:
            lpr_client = get_open_lpr_client()
            lpr_res = lpr_client.detect(
                image_bytes=file_bytes,
                image_shape=(image.shape[0], image.shape[1]),
            )
            if lpr_res and lpr_res.plate_number:
                recognized_plates.append({
                    "plate_number": lpr_res.plate_number,
                    "confidence": float(lpr_res.confidence),
                    "bbox": [float(v) for v in lpr_res.bbox],
                })
                print(
                    f"[ml-service] Open-LPR detected plate: {lpr_res.plate_number} "
                    f"(conf={lpr_res.confidence:.3f})"
                )
        except Exception as e:
            print(f"[ml-service] Open-LPR detection attempt error: {e}")

    plate_model = get_plate_model() if (not settings.OPEN_LPR_ENABLED or settings.OPEN_LPR_FALLBACK_TO_EASYOCR or not recognized_plates) else None

    if plate_model is not None:
        plate_results = plate_model.predict(
            image,
            conf=settings.PLATE_CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        scale_back = 1

        # If normal detection fails, upscale the image moderately
        if (
            not plate_results
            or plate_results[0].boxes is None
            or len(plate_results[0].boxes) == 0
        ):
            scale = 1.5
            enlarged_image = cv2.resize(
                image,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_LINEAR,
            )
            plate_results = plate_model.predict(
                enlarged_image,
                conf=0.08,
                verbose=False,
            )
            scale_back = scale

        if plate_results and plate_results[0].boxes is not None:
            detections = []
            for box in plate_results[0].boxes:
                confidence = float(box.conf[0])
                coords = [float(x) for x in box.xyxy[0].tolist()]
                if scale_back != 1:
                    coords = [x / scale_back for x in coords]
                detections.append((confidence, coords))

            detections.sort(key=lambda x: x[0], reverse=True)

            valid_boxes = []
            for confidence, coords in detections:
                x1, y1, x2, y2 = map(int, coords)
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(image.shape[1], x2)
                y2 = min(image.shape[0], y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                valid_boxes.append((confidence, [x1, y1, x2, y2]))

            # Pass 3b: Search for plates within each detected vehicle crop
            # Catches visor plates, small plates, and kickstand-tilted plates that full-image pass missed.
            if detected_vehicle_boxes:
                for v_item in detected_vehicle_boxes:
                    v_box = v_item.get("bbox", [])
                    if len(v_box) != 4:
                        continue
                    vx1, vy1, vx2, vy2 = [int(v) for v in v_box]

                    # Skip vehicle crop search if vehicle already has a detected plate box
                    has_plate = False
                    for _, p_box in valid_boxes:
                        px1, py1, px2, py2 = p_box
                        p_cx = (px1 + px2) / 2.0
                        p_cy = (py1 + py2) / 2.0
                        if vx1 <= p_cx <= vx2 and vy1 <= p_cy <= vy2:
                            has_plate = True
                            break
                    if has_plate:
                        continue

                    pad_v = 25
                    vx1_pad = max(0, vx1 - pad_v)
                    vy1_pad = max(0, vy1 - pad_v)
                    vx2_pad = min(image.shape[1], vx2 + pad_v)
                    vy2_pad = min(image.shape[0], vy2 + pad_v)
                    v_crop = image[vy1_pad:vy2_pad, vx1_pad:vx2_pad]
                    if v_crop.size == 0 or v_crop.shape[0] < 20 or v_crop.shape[1] < 20:
                        continue

                    v_angles = [0]
                    if v_item.get("class_name") == "motorcycle":
                        v_angles.extend([20, -20, 25, -25])

                    vh, vw = v_crop.shape[:2]
                    v_center = (vw // 2, vh // 2)

                    found_plate_in_vehicle = False
                    for ang in v_angles:
                        if ang != 0 and found_plate_in_vehicle:
                            break
                        if ang == 0:
                            crop_test = v_crop
                            M_inv = None
                        else:
                            M = cv2.getRotationMatrix2D(v_center, ang, 1.0)
                            crop_test = cv2.warpAffine(v_crop, M, (vw, vh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                            M_inv = cv2.invertAffineTransform(M)

                        v_res = plate_model.predict(crop_test, conf=0.15, verbose=False)[0]
                        if v_res.boxes is not None and len(v_res.boxes) > 0:
                            found_plate_in_vehicle = True
                            for b in v_res.boxes:
                                b_conf = float(b.conf[0])
                                bx1, by1, bx2, by2 = [float(x) for x in b.xyxy[0].tolist()]
                                if M_inv is not None:
                                    pts = np.array([
                                        [bx1, by1],
                                        [bx2, by1],
                                        [bx2, by2],
                                        [bx1, by2]
                                    ], dtype=np.float32)
                                    unrot = cv2.transform(np.array([pts]), M_inv)[0]
                                    fx1 = int(np.min(unrot[:, 0])) + vx1_pad
                                    fy1 = int(np.min(unrot[:, 1])) + vy1_pad
                                    fx2 = int(np.max(unrot[:, 0])) + vx1_pad
                                    fy2 = int(np.max(unrot[:, 1])) + vy1_pad
                                else:
                                    fx1 = int(bx1) + vx1_pad
                                    fy1 = int(by1) + vy1_pad
                                    fx2 = int(bx2) + vx1_pad
                                    fy2 = int(by2) + vy1_pad

                                fx1 = max(0, min(image.shape[1] - 1, fx1))
                                fy1 = max(0, min(image.shape[0] - 1, fy1))
                                fx2 = max(fx1 + 5, min(image.shape[1], fx2))
                                fy2 = max(fy1 + 5, min(image.shape[0], fy2))

                                valid_boxes.append((b_conf, [fx1, fy1, fx2, fy2]))

                                # Try recognizing the leveled crop from crop_test immediately
                                ibx1, iby1, ibx2, iby2 = int(bx1), int(by1), int(bx2), int(by2)
                                ibx1 = max(0, min(vw - 1, ibx1))
                                iby1 = max(0, min(vh - 1, iby1))
                                ibx2 = max(ibx1 + 5, min(vw, ibx2))
                                iby2 = max(iby1 + 5, min(vh, iby2))
                                p_leveled = crop_test[iby1:iby2, ibx1:ibx2]
                                if p_leveled.size > 0:
                                    allow_s9 = (ang != 0)
                                    val_fp, raw_cand, fp_conf = _ocr_plate_fastplate(p_leveled, allow_two_line=False, allow_slot9=allow_s9)
                                    if val_fp is not None:
                                        print(f"[ml-service] Vehicle-crop plate match: {val_fp} (bbox={[fx1, fy1, fx2, fy2]}, conf={fp_conf})")
                                        if not any(p["plate_number"] == val_fp for p in recognized_plates):
                                            recognized_plates.append({
                                                "plate_number": val_fp,
                                                "confidence": float(fp_conf or 0.94),
                                                "bbox": [fx1, fy1, fx2, fy2],
                                            })

            # Cluster overlapping boxes into distinct physical plate instances
            clusters = _cluster_plate_boxes(valid_boxes, iou_thresh=0.08)
            for cluster in clusters:
                # If this cluster corresponds to a plate already recognized, skip it
                cluster_box = [
                    min(b[1][0] for b in cluster),
                    min(b[1][1] for b in cluster),
                    max(b[1][2] for b in cluster),
                    max(b[1][3] for b in cluster),
                ]
                if any(_iou(cluster_box, p["bbox"]) > 0.25 for p in recognized_plates):
                    continue

                rec_res = _recognize_plate_cluster(image, cluster)
                if rec_res is not None:
                    # Avoid duplicate plate entries
                    if not any(p["plate_number"] == rec_res["plate_number"] for p in recognized_plates):
                        recognized_plates.append(rec_res)

        # Pass 4: Tilted/Rotated plate search (handles motorcycle kickstand lean, tilted mounts, etc.)
        if not recognized_plates:
            h_orig, w_orig = image.shape[:2]
            center = (w_orig // 2, h_orig // 2)
            for angle in [15, -15, 20, -20]:
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rot = cv2.warpAffine(image, M, (w_orig, h_orig), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                res_rot = plate_model.predict(rot, conf=0.20, verbose=False)[0]
                if res_rot.boxes is not None and len(res_rot.boxes) > 0:
                    for b in res_rot.boxes:
                        rx1, ry1, rx2, ry2 = b.xyxy[0].cpu().numpy().astype(int).tolist()
                        for pad_r in [0, 8, 16, 20]:
                            crop_rot = rot[max(0, ry1-4):min(h_orig, ry2+4), max(0, rx1-4):min(w_orig, rx2+pad_r)]
                            val_fp, raw, ocr_c = _ocr_plate_fastplate(crop_rot)
                            if val_fp:
                                print(
                                    f"[ml-service] Tilted plate detected at {angle} deg: "
                                    f"{val_fp} (conf={ocr_c})"
                                )
                                M_inv = cv2.invertAffineTransform(M)
                                pts = np.array([[rx1, ry1], [rx2+pad_r, ry1], [rx2+pad_r, ry2], [rx1, ry2]], dtype=np.float32)
                                pts_orig = cv2.transform(np.array([pts]), M_inv)[0]
                                plate_box = [
                                    int(max(0, np.min(pts_orig[:, 0]))),
                                    int(max(0, np.min(pts_orig[:, 1]))),
                                    int(min(w_orig, np.max(pts_orig[:, 0]))),
                                    int(min(h_orig, np.max(pts_orig[:, 1]))),
                                ]
                                recognized_plates.append({
                                    "plate_number": val_fp,
                                    "confidence": float(ocr_c or 0.9),
                                    "bbox": plate_box,
                                })
                                break
                        if recognized_plates:
                            break
                if recognized_plates:
                    break

    # Add plate boxes to boxes list
    for p in recognized_plates:
        boxes.append({
            "class_name": "license_plate",
            "confidence": float(p["confidence"]),
            "bbox": [float(x) for x in p["bbox"]],
        })

    # Add detected vehicle boxes to boxes list
    for v in detected_vehicle_boxes:
        boxes.append({
            "class_name": v["class_name"],
            "confidence": float(v["confidence"]),
            "bbox": [float(x) for x in v["bbox"]],
        })

    # ========================================================
    # 5. SPATIAL ASSOCIATION (VEHICLES + PLATES + VIOLATIONS)
    # ========================================================

    detected_vehicles = _associate_vehicles_plates_violations(
        vehicles=detected_vehicle_boxes,
        plates=recognized_plates,
        helmet_boxes=helmet_boxes,
        wrong_side_boxes=wrong_side_boxes,
        triple_riding_boxes=triple_results,
    )

    # ========================================================
    # 6. PRIMARY PLATE SELECTION (FOR BACKWARD COMPATIBILITY)
    # ========================================================

    primary_plate_number = None
    primary_plate_confidence = None

    for v in detected_vehicles:
        if v.get("violations_found") and v.get("plate_number"):
            primary_plate_number = v["plate_number"]
            primary_plate_confidence = v["plate_confidence"]
            break

    if primary_plate_number is None and recognized_plates:
        best_p = max(recognized_plates, key=lambda x: x.get("confidence", 0.0))
        primary_plate_number = best_p["plate_number"]
        primary_plate_confidence = best_p["confidence"]

    # ========================================================
    # 7. RESULT
    # ========================================================

    return {
        "violations_found": violations_found,
        "plate_number": primary_plate_number,
        "plate_confidence": primary_plate_confidence,
        "boxes": boxes,
        "detected_vehicles": detected_vehicles,
        "annotated_file_path": None,
    }


def _annotate_frame_image(
    image: np.ndarray,
    boxes: List[Dict[str, Any]],
    violations: List[str],
    plate_number: Optional[str] = None,
    plate_conf: Optional[float] = None,
    detected_vehicles: Optional[List[Dict[str, Any]]] = None,
) -> np.ndarray:
    """Draw bounding boxes, badges, and top summary banner on a frame."""
    img = image.copy()
    detected_vehicles = detected_vehicles or []

    occupied_badges = []
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.50
    thickness = 1

    for b in boxes:
        cls_name = str(b.get("class_name", ""))
        conf = float(b.get("confidence", 0.0))
        box = b.get("bbox") or b.get("coords", [])
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = [int(v) for v in box]

        is_viol = "without" in cls_name.lower() or "wrong" in cls_name.lower() or "triple" in cls_name.lower()
        is_plate = cls_name in ("0", "license_plate")
        is_veh = cls_name in ("motorcycle", "car", "bus", "truck", "bicycle", "vehicle")

        if is_plate:
            color = (0, 255, 0)
            p_text = plate_number
            label = f"PLATE: {p_text} ({conf:.2f})" if p_text else f"Plate ({conf:.2f})"
        elif is_viol:
            color = (0, 0, 255)
            label = f"VIOLATION: {cls_name} ({conf:.2f})"
        elif is_veh:
            color = (255, 165, 0)
            label = f"{cls_name} ({conf:.2f})"
        else:
            color = (200, 200, 200)
            label = f"{cls_name} ({conf:.2f})"

        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)

        # Stagger badge positions to avoid overlapping text
        if is_veh and not is_viol:
            ty = min(img.shape[0] - 6, y2 - 4)
        else:
            ty = max(y1 - 6, th + 6)
            for ox, oy in occupied_badges:
                if abs(x1 - ox) < 120 and abs(ty - oy) < (th + 8):
                    ty = max(th + 6, oy - (th + 8))

        occupied_badges.append((x1, ty))
        cv2.rectangle(img, (x1, ty - th - 4), (x1 + tw + 6, ty + 2), color, -1)
        cv2.putText(img, label, (x1 + 3, ty - 2), font, font_scale, (0, 0, 0), thickness, cv2.LINE_AA)

    # Top summary banner (2-row layout if narrow/vertical video)
    summary_viol = f"Violations: {', '.join(violations) if violations else 'None'}"
    all_plates = [v["plate_number"] for v in detected_vehicles if v.get("plate_number")]
    if len(all_plates) > 1:
        summary_plate = f"Plates: {', '.join(all_plates[:2])}"
    else:
        summary_plate = f"Plate: {plate_number or 'NOT READ'}"
        if plate_conf:
            summary_plate += f" ({plate_conf:.2f})"

    if img.shape[1] < 750:
        banner_h = 60
        banner = np.zeros((banner_h, img.shape[1], 3), dtype=np.uint8)
        banner[:] = (25, 25, 25)
        cv2.putText(banner, summary_plate, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0) if plate_number else (0, 165, 255), 2, cv2.LINE_AA)
        cv2.putText(banner, summary_viol, (12, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255) if violations else (200, 200, 200), 2, cv2.LINE_AA)
    else:
        banner_h = 44
        banner = np.zeros((banner_h, img.shape[1], 3), dtype=np.uint8)
        banner[:] = (25, 25, 25)
        cv2.putText(banner, summary_plate, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0) if plate_number else (0, 165, 255), 2, cv2.LINE_AA)
        (vw, vh), _ = cv2.getTextSize(summary_viol, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.putText(banner, summary_viol, (img.shape[1] - vw - 15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255) if violations else (200, 200, 200), 2, cv2.LINE_AA)

    return np.vstack([banner, img])


# ============================================================
# VEHICLE MOTION TRACKER & TRAFFIC FLOW ANALYSIS
# ============================================================

class _VehicleMotionTracker:
    """
    Tracks vehicle trajectories across video frames.
    Computes displacement motion vectors, determines the dominant traffic flow vector,
    and detects any vehicle traveling opposite to the traffic flow direction.
    """
    def __init__(self, max_missing_frames: int = 45):
        self.next_track_id = 1
        self.tracks: Dict[int, Dict[str, Any]] = {}
        self.max_missing_frames = max_missing_frames

    def update(
        self,
        frame_idx: int,
        detected_vehicles: List[Dict[str, Any]],
        frame_bgr: Optional[np.ndarray] = None,
    ):
        active_track_ids = [
            tid for tid, trk in self.tracks.items()
            if (frame_idx - trk["last_seen_frame"]) <= self.max_missing_frames
        ]

        assigned_track_ids = set()

        for det in detected_vehicles:
            dbox = det["bbox"]
            dcx = (dbox[0] + dbox[2]) / 2.0
            dcy = (dbox[1] + dbox[3]) / 2.0
            dw = max(1.0, dbox[2] - dbox[0])
            dh = max(1.0, dbox[3] - dbox[1])
            diag = (dw * dw + dh * dh) ** 0.5

            best_tid = None
            best_score = -1.0

            for tid in active_track_ids:
                if tid in assigned_track_ids:
                    continue
                trk = self.tracks[tid]
                last_pt = trk["history"][-1]
                tcx, tcy = last_pt[1], last_pt[2]
                dist = ((dcx - tcx) ** 2 + (dcy - tcy) ** 2) ** 0.5
                iou = _iou(dbox, last_pt[3])

                max_dist = max(80.0, diag * 0.8)
                if iou > 0.15 or dist < max_dist:
                    score = iou * 2.0 + max(0.0, 1.0 - (dist / max_dist))
                    if score > best_score:
                        best_score = score
                        best_tid = tid

            if best_tid is not None:
                assigned_track_ids.add(best_tid)
                trk = self.tracks[best_tid]
                trk["history"].append((frame_idx, dcx, dcy, dbox))
                trk["last_seen_frame"] = frame_idx
                trk["last_bbox"] = dbox
                if det.get("plate_number"):
                    c_conf = float(det.get("plate_confidence") or 0.0)
                    if not trk.get("plate_number") or c_conf > float(trk.get("plate_confidence") or 0.0):
                        trk["plate_number"] = det["plate_number"]
                        trk["plate_confidence"] = c_conf
                for viol in det.get("violations_found", []):
                    trk["violations_found"].add(viol)
                area = dw * dh
                if area > trk.get("best_area", 0):
                    trk["best_area"] = area
                    trk["best_frame_idx"] = frame_idx
                    trk["best_bbox"] = dbox
                    if frame_bgr is not None:
                        trk["best_frame_bgr"] = frame_bgr.copy()
            else:
                tid = self.next_track_id
                self.next_track_id += 1
                self.tracks[tid] = {
                    "track_id": tid,
                    "vehicle_type": det.get("vehicle_type", "vehicle"),
                    "history": [(frame_idx, dcx, dcy, dbox)],
                    "last_seen_frame": frame_idx,
                    "last_bbox": dbox,
                    "plate_number": det.get("plate_number"),
                    "plate_confidence": det.get("plate_confidence"),
                    "violations_found": set(det.get("violations_found", [])),
                    "best_area": dw * dh,
                    "best_frame_idx": frame_idx,
                    "best_bbox": dbox,
                    "best_frame_bgr": frame_bgr.copy() if frame_bgr is not None else None,
                }

    def analyze_traffic_flow(self) -> Dict[str, Any]:
        """
        Calculates the dominant traffic flow direction across moving vehicles.
        Identifies any vehicles driving opposite to the dominant traffic flow.
        """
        moving_tracks = []

        for tid, trk in self.tracks.items():
            hist = trk["history"]
            if len(hist) < 2:
                continue

            first_pt = hist[0]
            last_pt = hist[-1]
            dx = last_pt[1] - first_pt[1]
            dy = last_pt[2] - first_pt[2]
            dist = (dx * dx + dy * dy) ** 0.5

            # Significant motion threshold: vehicle moved at least 20 pixels
            if dist >= 20.0:
                ux = dx / dist
                uy = dy / dist
                moving_tracks.append({
                    "track_id": tid,
                    "dx": dx,
                    "dy": dy,
                    "dist": dist,
                    "unit_vector": (ux, uy),
                    "track": trk,
                })

        if not moving_tracks:
            return {
                "dominant_flow_vector": None,
                "wrong_side_tracks": [],
                "moving_track_count": 0,
            }

        # Calculate dominant traffic flow vector (weighted by displacement distance)
        sum_vx = sum(mt["dist"] * mt["unit_vector"][0] for mt in moving_tracks)
        sum_vy = sum(mt["dist"] * mt["unit_vector"][1] for mt in moving_tracks)
        flow_mag = (sum_vx * sum_vx + sum_vy * sum_vy) ** 0.5

        if flow_mag < 1e-4:
            return {
                "dominant_flow_vector": None,
                "wrong_side_tracks": [],
                "moving_track_count": len(moving_tracks),
            }

        flow_ux = sum_vx / flow_mag
        flow_uy = sum_vy / flow_mag

        wrong_side_tracks = []

        # When at least 2 moving vehicles exist, evaluate direction against dominant flow
        if len(moving_tracks) >= 2:
            for mt in moving_tracks:
                ux, uy = mt["unit_vector"]
                cos_sim = ux * flow_ux + uy * flow_uy

                # Vehicle moves opposite to traffic flow if cosine similarity is strongly negative
                if cos_sim < -0.35:
                    trk = mt["track"]
                    trk["violations_found"].add("wrong_side")
                    trk["wrong_side_reason"] = (
                        f"Opposite traffic flow: direction [{ux:.2f}, {uy:.2f}] opposes "
                        f"dominant flow [{flow_ux:.2f}, {flow_uy:.2f}] (cos_sim={cos_sim:.2f})"
                    )
                    wrong_side_tracks.append(trk)

        return {
            "dominant_flow_vector": (flow_ux, flow_uy),
            "wrong_side_tracks": wrong_side_tracks,
            "moving_track_count": len(moving_tracks),
        }


# ============================================================
# PROCESS VIDEO
# ============================================================

def process_video(
    file_bytes: bytes
) -> Dict[str, Any]:

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".mp4",
    ) as temp_file:

        temp_file.write(
            file_bytes
        )

        temp_path = temp_file.name

    try:

        cap = cv2.VideoCapture(
            temp_path
        )

        if not cap.isOpened():

            raise ValueError(
                "Could not open video."
            )

        frame_count = 0
        all_violations = set()
        best_result = {
            "violations_found": [],
            "plate_number": None,
            "plate_confidence": None,
            "boxes": [],
            "detected_vehicles": [],
            "annotated_file_path": None,
        }
        best_frame_score = -1.0
        best_frame_bgr = None
        best_frame_boxes = []
        vehicle_plate_map = {}

        tracker = _VehicleMotionTracker(max_missing_frames=settings.VIDEO_FRAME_SAMPLE_RATE * 3)

        while True:
            success, frame = cap.read()
            if not success:
                break

            frame_count += 1
            if frame_count % settings.VIDEO_FRAME_SAMPLE_RATE != 0:
                continue

            encoded = cv2.imencode(".jpg", frame)[1]
            result = process_image(encoded.tobytes())

            frame_violations = result.get("violations_found", [])
            for v in frame_violations:
                all_violations.add(v)

            frame_plate = result.get("plate_number")
            frame_conf = float(result.get("plate_confidence") or 0.0)

            # Update tracker with vehicles detected in this frame
            frame_vehicles = result.get("detected_vehicles", [])
            tracker.update(frame_count, frame_vehicles, frame)

            # Track detected vehicles with plates across video frames
            for veh in frame_vehicles:
                vp = veh.get("plate_number")
                if vp:
                    vc = float(veh.get("plate_confidence") or 0.0)
                    if vp not in vehicle_plate_map or vc > float(vehicle_plate_map[vp].get("plate_confidence") or 0.0):
                        vehicle_plate_map[vp] = veh

            # Score frame: prioritize frames showing violations; plate confidence as tie-breaker
            frame_score = len(frame_violations) * 100.0 + (10.0 + frame_conf if frame_plate else 0.0)
            if frame_score > best_frame_score:
                best_frame_score = frame_score
                best_result["plate_number"] = frame_plate or best_result["plate_number"]
                best_result["plate_confidence"] = frame_conf if frame_plate else best_result["plate_confidence"]
                best_result["boxes"] = result.get("boxes", [])
                best_frame_boxes = result.get("boxes", [])
                best_frame_bgr = frame.copy()
                if frame_vehicles:
                    best_result["detected_vehicles"] = frame_vehicles

        cap.release()

        # Run traffic flow trajectory analysis across video tracks
        flow_analysis = tracker.analyze_traffic_flow()
        ws_tracks = flow_analysis.get("wrong_side_tracks", [])
        if ws_tracks:
            all_violations.add("wrong_side")
            for wst in ws_tracks:
                wp = wst.get("plate_number")
                if wp and wp in vehicle_plate_map:
                    if "wrong_side" not in vehicle_plate_map[wp]["violations_found"]:
                        vehicle_plate_map[wp]["violations_found"].append("wrong_side")
                elif wp:
                    vehicle_plate_map[wp] = {
                        "vehicle_type": wst.get("vehicle_type", "vehicle"),
                        "confidence": 1.0,
                        "bbox": wst.get("best_bbox", []),
                        "plate_number": wp,
                        "plate_confidence": wst.get("plate_confidence", 0.9),
                        "violations_found": ["wrong_side"],
                    }

                # Ensure wrong-side bounding box is recorded
                bbox = wst.get("best_bbox")
                if bbox:
                    best_frame_boxes.append({
                        "class_name": "wrong_side",
                        "confidence": 0.88,
                        "bbox": bbox,
                    })

            # If best frame didn't have violations previously, choose the wrong-side vehicle's best frame
            if best_frame_score <= 10.0 and ws_tracks:
                wst_with_frame = next((t for t in ws_tracks if t.get("best_frame_bgr") is not None), None)
                if wst_with_frame:
                    best_frame_bgr = wst_with_frame["best_frame_bgr"]

        best_result["violations_found"] = list(all_violations)
        if vehicle_plate_map:
            best_result["detected_vehicles"] = list(vehicle_plate_map.values())
            # Prioritize vehicle plate with associated violations
            viol_vehs = [v for v in vehicle_plate_map.values() if v.get("violations_found") and v.get("plate_number")]
            if viol_vehs:
                top_veh = max(viol_vehs, key=lambda v: float(v.get("plate_confidence") or 0.0))
                best_result["plate_number"] = top_veh.get("plate_number")
                best_result["plate_confidence"] = top_veh.get("plate_confidence")
            elif not best_result.get("plate_number"):
                top_veh = max(vehicle_plate_map.values(), key=lambda v: float(v.get("plate_confidence") or 0.0))
                best_result["plate_number"] = top_veh.get("plate_number")
                best_result["plate_confidence"] = top_veh.get("plate_confidence")

        # Save annotated key violation frame
        if best_frame_bgr is not None:
            annotated_frame = _annotate_frame_image(
                best_frame_bgr,
                best_frame_boxes,
                best_result["violations_found"],
                best_result.get("plate_number"),
                best_result.get("plate_confidence"),
                best_result.get("detected_vehicles", []),
            )
            out_dir = os.path.join(tempfile.gettempdir(), "traffic_challan_annotated")
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, f"annotated_video_{int(time.time() * 1000)}.jpg")
            cv2.imwrite(out_file, annotated_frame)
            best_result["annotated_file_path"] = out_file

        return best_result

    finally:

        if os.path.exists(temp_path):
            os.remove(temp_path)