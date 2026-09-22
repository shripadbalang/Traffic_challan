import os
import re
import tempfile
from typing import List, Dict, Any

import cv2
import numpy as np

from app.config import settings
from app.models_loader import (
    get_general_model,
    get_helmet_model,
    get_wrong_side_model,
    get_plate_model,
)

_easyocr_reader = None


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

    pattern = r"^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$"

    return bool(re.fullmatch(pattern, text))


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
        "0": "O",
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
            if ch.isalpha():
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

        if (
            1 <= len(series) <= 3
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
                + r"[A-Z]{1,3}"
                + r"\d{3,4}$"
            )

            if re.fullmatch(pattern, candidate_text):
                return candidate_text

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


# ============================================================
# OCR PLATE
# ============================================================

def _ocr_plate(
    crop: np.ndarray
):

    if crop is None or crop.size == 0:
        return None, None

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
# TRIPLE RIDING
# ============================================================

def _detect_triple_riding(
    image: np.ndarray
) -> List[Dict[str, Any]]:

    model = get_general_model()

    if model is None:
        return []

    results = model.predict(
        image,
        conf=0.40,
        verbose=False,
    )

    if not results:
        return []

    result = results[0]

    if result.boxes is None:
        return []

    motorcycles = []
    people = []

    for box in result.boxes:

        cls_id = int(
            box.cls[0]
        )

        confidence = float(
            box.conf[0]
        )

        coords = (
            box.xyxy[0]
            .tolist()
        )

        if (
            cls_id
            == settings.MOTORCYCLE_CLASS_ID
        ):

            motorcycles.append(
                {
                    "bbox": coords,
                    "confidence": confidence,
                }
            )

        elif (
            cls_id
            == settings.PERSON_CLASS_ID
        ):

            people.append(
                {
                    "bbox": coords,
                    "confidence": confidence,
                }
            )

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

            if (
                iou
                >= settings.TRIPLE_RIDING_PERSON_IOU_THRESHOLD
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
        raise ValueError(
            "Could not decode image."
        )

    violations_found = []
    boxes = []

    # ========================================================
    # HELMET
    # ========================================================

    helmet_model = get_helmet_model()

    if helmet_model is not None:

        helmet_results = (
            helmet_model.predict(
                image,
                conf=settings.CONFIDENCE_THRESHOLD,
                verbose=False,
            )
        )

        if helmet_results:

            result = helmet_results[0]

            if result.boxes is not None:

                for box in result.boxes:

                    cls_id = int(
                        box.cls[0]
                    )

                    confidence = float(
                        box.conf[0]
                    )

                    class_name = str(
                        helmet_model.names[
                            cls_id
                        ]
                    ).lower()

                    coords = [
                        float(x)
                        for x
                        in box.xyxy[
                            0
                        ].tolist()
                    ]

                    boxes.append(
                        {
                            "class_name": (
                                class_name
                            ),
                            "confidence": (
                                confidence
                            ),
                            "bbox": coords,
                        }
                    )

                    if (
                        class_name
                        == settings
                        .HELMET_VIOLATION_CLASS_NAME
                        .lower()
                    ):

                        if (
                            "no_helmet"
                            not in violations_found
                        ):

                            violations_found.append(
                                "no_helmet"
                            )

    # ========================================================
    # WRONG SIDE
    # ========================================================

    wrong_side_model = (
        get_wrong_side_model()
    )

    if wrong_side_model is not None:

        wrong_results = (
            wrong_side_model.predict(
                image,
                conf=settings.CONFIDENCE_THRESHOLD,
                verbose=False,
            )
        )

        if wrong_results:

            result = wrong_results[0]

            if result.boxes is not None:

                for box in result.boxes:

                    cls_id = int(
                        box.cls[0]
                    )

                    confidence = float(
                        box.conf[0]
                    )

                    class_name = str(
                        wrong_side_model.names[
                            cls_id
                        ]
                    ).lower()

                    coords = [
                        float(x)
                        for x
                        in box.xyxy[
                            0
                        ].tolist()
                    ]

                    boxes.append(
                        {
                            "class_name": (
                                class_name
                            ),
                            "confidence": (
                                confidence
                            ),
                            "bbox": coords,
                        }
                    )

                    if (
                        class_name
                        == settings
                        .WRONG_SIDE_VIOLATION_CLASS_NAME
                        .lower()
                    ):

                        if (
                            "wrong_side"
                            not in violations_found
                        ):

                            violations_found.append(
                                "wrong_side"
                            )

    # ========================================================
    # TRIPLE RIDING
    # ========================================================

    triple_results = (
        _detect_triple_riding(
            image
        )
    )

    for item in triple_results:

        boxes.append(item)

        if (
            "triple_riding"
            not in violations_found
        ):

            violations_found.append(
                "triple_riding"
            )

    # ========================================================
    # NUMBER PLATE
    # ========================================================

    plate_number = None
    plate_confidence = None

    plate_model = get_plate_model()

    if plate_model is not None:

        plate_results = (
            plate_model.predict(
                image,
                conf=settings.PLATE_CONFIDENCE_THRESHOLD,
                verbose=False,
            )
        )

        scale_back = 1

        # ----------------------------------------------------
        # If normal detection fails, upscale the image.
        # ----------------------------------------------------

        if (
            not plate_results
            or plate_results[0].boxes is None
            or len(
                plate_results[0].boxes
            ) == 0
        ):

            scale = 4

            enlarged_image = cv2.resize(
                image,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_CUBIC,
            )

            plate_results = (
                plate_model.predict(
                    enlarged_image,
                    conf=0.01,
                    imgsz=1280,
                    verbose=False,
                )
            )

            scale_back = scale

        # ----------------------------------------------------
        # Process plate detections.
        # ----------------------------------------------------

        if plate_results:

            result = plate_results[0]

            if result.boxes is not None:

                detections = []

                for box in result.boxes:

                    confidence = float(
                        box.conf[0]
                    )

                    coords = [
                        float(x)
                        for x
                        in box.xyxy[
                            0
                        ].tolist()
                    ]

                    if scale_back != 1:

                        coords = [
                            x / scale_back
                            for x in coords
                        ]

                    detections.append(
                        (
                            confidence,
                            coords,
                        )
                    )

                detections.sort(
                    key=lambda x: x[0],
                    reverse=True,
                )

                for confidence, coords in detections:

                    x1, y1, x2, y2 = map(
                        int,
                        coords,
                    )

                    x1 = max(0, x1)
                    y1 = max(0, y1)

                    x2 = min(
                        image.shape[1],
                        x2,
                    )

                    y2 = min(
                        image.shape[0],
                        y2,
                    )

                    if (
                        x2 <= x1
                        or y2 <= y1
                    ):
                        continue

                    print(
                        f"[ml-service] "
                        f"Plate detected: "
                        f"confidence="
                        f"{confidence:.3f} "
                        f"bbox="
                        f"{[x1, y1, x2, y2]}"
                    )

                    crop = image[
                        y1:y2,
                        x1:x2
                    ]

                    text, ocr_confidence = (
                        _ocr_plate(crop)
                    )

                    if text is not None:

                        plate_number = text

                        plate_confidence = (
                            ocr_confidence
                        )

                        break

                if plate_number is None:

                    print(
                        "[ml-service] "
                        "Plate detected, "
                        "but EasyOCR could "
                        "not read a valid "
                        "plate."
                    )

    # ========================================================
    # RESULT
    # ========================================================

    return {
        "violations_found": (
            violations_found
        ),
        "plate_number": (
            plate_number
        ),
        "plate_confidence": (
            plate_confidence
        ),
        "boxes": boxes,
        "annotated_file_path": None,
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

        last_result = {
            "violations_found": [],
            "plate_number": None,
            "plate_confidence": None,
            "boxes": [],
            "annotated_file_path": None,
        }

        while True:

            success, frame = cap.read()

            if not success:
                break

            frame_count += 1

            if (
                frame_count
                % settings.VIDEO_FRAME_SAMPLE_RATE
                != 0
            ):
                continue

            encoded = cv2.imencode(
                ".jpg",
                frame,
            )[1]

            result = process_image(
                encoded.tobytes()
            )

            last_result = result

            for violation in result[
                "violations_found"
            ]:

                all_violations.add(
                    violation
                )

        cap.release()

        last_result[
            "violations_found"
        ] = list(all_violations)

        return last_result

    finally:

        if os.path.exists(temp_path):
            os.remove(temp_path)