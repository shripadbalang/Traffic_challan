import argparse
import os
import sys
import cv2
import numpy as np

# Ensure ml-service root is in sys.path
INIT_CWD = os.getcwd()
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ML_SERVICE_DIR = os.path.join(BASE_DIR, "ml-service")
sys.path.insert(0, ML_SERVICE_DIR)
os.chdir(ML_SERVICE_DIR)

from app.detect import process_image


def annotate_image(image_bytes: bytes, result: dict) -> np.ndarray:
    """Draw bounding boxes and detection tags on the image."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        try:
            import io
            from PIL import Image
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            return None

    boxes = result.get("boxes", [])
    plate_number = result.get("plate_number")
    plate_conf = result.get("plate_confidence")
    detected_vehicles = result.get("detected_vehicles", [])

    # Colors (BGR)
    COLOR_PLATE = (0, 255, 0)       # Green
    COLOR_VIOLATION = (0, 0, 255)   # Red
    COLOR_VEHICLE = (255, 165, 0)   # Orange / Cyan
    COLOR_PERSON = (255, 200, 0)    # Light Blue

    # Helper IoU for matching
    def box_iou(b1, b2):
        ix1, iy1 = max(b1[0], b2[0]), max(b1[1], b2[1])
        ix2, iy2 = min(b1[2], b2[2]), min(b1[3], b2[3])
        iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
        inter = iw * ih
        a1 = max(0, b1[2] - b1[0]) * max(0, b1[3] - b1[1])
        a2 = max(0, b2[2] - b2[0]) * max(0, b2[3] - b2[1])
        union = a1 + a2 - inter
        return inter / union if union > 0 else 0.0

    for b in boxes:
        cls_name = str(b.get("class_name", ""))
        conf = float(b.get("confidence", 0.0))
        box = b.get("bbox") or b.get("box", [])
        if len(box) != 4:
            continue

        x1, y1, x2, y2 = map(int, box)

        # Decide color & label
        if cls_name in ("0", "license_plate"):
            color = COLOR_PLATE
            # Find specific plate number for this box if multiple
            p_text = None
            for v in detected_vehicles:
                p_box = v.get("plate_bbox")
                if p_box and box_iou(box, p_box) > 0.4:
                    p_text = v.get("plate_number")
                    break
            p_text = p_text or plate_number
            if p_text:
                label = f"PLATE: {p_text} ({conf:.2f})"
            else:
                label = f"Plate ({conf:.2f})"
        elif "without helmet" in cls_name.lower() or "wrong" in cls_name.lower() or "triple" in cls_name.lower():
            color = COLOR_VIOLATION
            label = f"VIOLATION: {cls_name} ({conf:.2f})"
        elif cls_name in ("motorcycle", "car", "bus", "truck", "bicycle", "vehicle"):
            color = COLOR_VEHICLE
            # Find if this vehicle has an assigned plate
            veh_plate = None
            for v in detected_vehicles:
                if v.get("bbox") and box_iou(box, v["bbox"]) > 0.7:
                    veh_plate = v.get("plate_number")
                    break
            if veh_plate:
                label = f"{cls_name} [{veh_plate}] ({conf:.2f})"
            else:
                label = f"{cls_name} ({conf:.2f})"
        elif cls_name == "person":
            color = COLOR_PERSON
            label = f"person ({conf:.2f})"
        else:
            color = (200, 200, 200)
            label = f"{cls_name} ({conf:.2f})"

        # Draw box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        # Draw label badge
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.55
        thickness = 1
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        ty = max(y1 - 6, th + 6)
        cv2.rectangle(img, (x1, ty - th - 4), (x1 + tw + 6, ty + 2), color, -1)
        cv2.putText(img, label, (x1 + 3, ty - 2), font, font_scale, (0, 0, 0), thickness, cv2.LINE_AA)

    # Banner at top showing summary
    violations = result.get("violations_found", [])
    summary_viol = f"Violations: {', '.join(violations) if violations else 'None'}"
    all_plates = [v["plate_number"] for v in detected_vehicles if v.get("plate_number")]
    if len(all_plates) > 1:
        summary_plate = f"Plates: {', '.join(all_plates)}"
    else:
        summary_plate = f"Plate: {plate_number or 'NOT READ'}"
        if plate_conf:
            summary_plate += f" ({plate_conf:.2f})"

    if img.shape[1] < 600:
        banner_h = 56
        banner = np.zeros((banner_h, img.shape[1], 3), dtype=np.uint8)
        banner[:] = (25, 25, 25)
        cv2.putText(banner, summary_plate, (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0) if plate_number else (0, 165, 255), 2, cv2.LINE_AA)
        cv2.putText(banner, summary_viol, (12, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255) if violations else (200, 200, 200), 2, cv2.LINE_AA)
    else:
        banner_h = 40
        banner = np.zeros((banner_h, img.shape[1], 3), dtype=np.uint8)
        banner[:] = (25, 25, 25)
        cv2.putText(banner, summary_plate, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0) if plate_number else (0, 165, 255), 2, cv2.LINE_AA)
        (vw, vh), _ = cv2.getTextSize(summary_viol, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.putText(banner, summary_viol, (img.shape[1] - vw - 15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255) if violations else (200, 200, 200), 2, cv2.LINE_AA)

    output = np.vstack([banner, img])
    return output


def main():
    parser = argparse.ArgumentParser(description="Manually test detection and OCR on a single image.")
    parser.add_argument(
        "image_path",
        nargs="?",
        default=os.path.join(BASE_DIR, "test-assets", "samples", "bike_plate.jpg"),
        help="Path to the image to test (default: test-assets/samples/bike_plate.jpg)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Path to save annotated output image (default: <image_dir>/annotated_<image_name>)",
    )

    args = parser.parse_args()
    raw_path = args.image_path
    if not os.path.isabs(raw_path):
        image_path = os.path.abspath(os.path.join(INIT_CWD, raw_path))
    else:
        image_path = os.path.abspath(raw_path)

    if not os.path.exists(image_path):
        print(f"Error: File not found: {image_path}")
        sys.exit(1)

    print("=" * 70)
    print(f"  MANUAL IMAGE DETECTION & OCR TEST")
    print("=" * 70)
    print(f"Target Image : {image_path}")
    print(f"File Size    : {os.path.getsize(image_path):,} bytes")

    with open(image_path, "rb") as f:
        file_bytes = f.read()

    print("\nRunning ML pipeline (YOLO Detection + FastPlateOCR / EasyOCR)...")
    result = process_image(file_bytes)

    plate = result.get("plate_number")
    conf = result.get("plate_confidence")
    violations = result.get("violations_found", [])
    boxes = result.get("boxes", [])
    detected_vehicles = result.get("detected_vehicles", [])

    print("\n" + "-" * 70)
    print("  DETECTION RESULTS")
    print("-" * 70)
    print(f"Primary Plate      : {plate if plate else 'NOT READ'}")
    print(f"Plate Confidence   : {f'{conf:.3f} ({conf*100:.1f}%)' if conf else 'N/A'}")
    print(f"Violations Found   : {', '.join(violations) if violations else 'None'}")
    print(f"Total Objects/Boxes: {len(boxes)}")
    print(f"Vehicles Detected  : {len(detected_vehicles)}")

    if detected_vehicles:
        print("\n" + "-" * 70)
        print("  DETECTED VEHICLES & ASSOCIATED PLATES")
        print("-" * 70)
        for idx, veh in enumerate(detected_vehicles, 1):
            v_type = veh.get("vehicle_type", "vehicle")
            v_conf = veh.get("confidence", 0.0)
            v_plate = veh.get("plate_number") or "None"
            v_plate_conf = veh.get("plate_confidence")
            v_viols = veh.get("violations_found") or []
            p_conf_str = f" ({v_plate_conf*100:.1f}%)" if v_plate_conf else ""
            print(
                f"  Vehicle #{idx}: {v_type:<10} (conf: {v_conf:.2f}) "
                f"| Plate: {v_plate:<12}{p_conf_str} "
                f"| Violations: {', '.join(v_viols) if v_viols else 'None'}"
            )

    if boxes:
        print("\nDetected Bounding Boxes:")
        for idx, b in enumerate(boxes, 1):
            cls = b.get("class_name")
            c = b.get("confidence", 0.0)
            box = b.get("bbox") or b.get("box", [])
            print(f"  [{idx}] Class: {cls:<16} Confidence: {c:.3f}  Box: {box}")

    # Generate and save annotated image
    out_dir = os.path.dirname(image_path)
    base_name = os.path.basename(image_path)
    default_out = os.path.join(out_dir, f"annotated_{base_name}")
    if args.output:
        out_path = os.path.abspath(args.output) if os.path.isabs(args.output) else os.path.abspath(os.path.join(INIT_CWD, args.output))
    else:
        out_path = default_out

    annotated_img = annotate_image(file_bytes, result)
    if annotated_img is not None:
        cv2.imwrite(out_path, annotated_img)
        print("\n" + "=" * 70)
        print(f"Annotated Image Saved: {out_path}")
        print("You can open this image in any photo viewer to inspect the visual overlay.")
        print("=" * 70)


if __name__ == "__main__":
    main()
