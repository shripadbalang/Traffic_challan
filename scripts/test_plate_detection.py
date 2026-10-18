import glob
import os
import sys

# Add ml-service to path
ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml-service"))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

from app.detect import process_image

sample_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test-assets", "samples"))
ignore_prefixes = ("annotated_", "strip_", "angle", "car_plate", "moto_", "plate_", "white_plate", "debug_", "crop_")
images = [
    p for p in sorted(glob.glob(os.path.join(sample_dir, "*.jpg")))
    if not os.path.basename(p).startswith(ignore_prefixes)
]

print(f"Testing {len(images)} sample images for license plate detection and OCR...\n")

results = []
for img_path in images:
    name = os.path.basename(img_path)
    with open(img_path, "rb") as f:
        file_bytes = f.read()
    try:
        res = process_image(file_bytes)
        plate = res.get("plate_number")
        conf = res.get("plate_confidence")
        conf_str = f"{conf:.2f}" if conf else "N/A"
        violations = res.get("violations_found", [])
        boxes = res.get("boxes", [])
        plate_boxes = [b for b in boxes if b.get("class_name") in ("0", "license_plate")]
        det_vehicles = res.get("detected_vehicles", [])
        veh_plates = [v.get("plate_number") for v in det_vehicles if v.get("plate_number")]
        results.append({
            "name": name,
            "plate": plate,
            "all_plates": veh_plates,
            "conf": conf_str,
            "violations": violations,
            "plate_detected": len(plate_boxes) > 0 or plate is not None,
        })
    except Exception as e:
        results.append({
            "name": name,
            "plate": f"ERROR: {e}",
            "all_plates": [],
            "conf": "N/A",
            "violations": [],
            "plate_detected": False,
        })

header = f"| {'IMAGE NAME':<18} | {'PLATE BOUNDING BOX':<18} | {'DETECTED NUMBER(S)':<28} | {'CONF':<6} | {'VIOLATIONS':<22} |"
divider = "-" * len(header)
print(divider)
print(header)
print(divider)

for r in results:
    p_box = "YES" if r["plate_detected"] else "NO"
    if r["all_plates"]:
        p_num = ", ".join(r["all_plates"])
    else:
        p_num = r["plate"] if r["plate"] else "Not Read"
    v_str = ", ".join(r["violations"]) if r["violations"] else "none"
    print(f"| {r['name']:<18} | {p_box:<18} | {p_num:<28} | {r['conf']:<6} | {v_str:<22} |")

print(divider)
