import glob
import os
import sys
import cv2
import numpy as np
from PIL import Image

ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

from ultralytics import YOLO

ws_m = YOLO("models/wrong_side_best.pt")
gen_m = YOLO("models/yolo11n.pt")


def evaluate_wrong_side(img):
    gen_res = gen_m.predict(img, conf=0.25, verbose=False)[0]
    bikes = [b for b in gen_res.boxes if int(b.cls[0]) == 3]
    persons = [b for b in gen_res.boxes if int(b.cls[0]) == 0]
    cars = [b for b in gen_res.boxes if int(b.cls[0]) in (1, 2, 5, 7)]

    # Check for riders on two-wheelers
    active_vehicles = []
    for b in bikes:
        bb = b.xyxy[0].tolist()
        has_rider = False
        for p in persons:
            pb = p.xyxy[0].tolist()
            ix1, iy1 = max(bb[0], pb[0]), max(bb[1], pb[1])
            ix2, iy2 = min(bb[2], pb[2]), min(bb[3], pb[3])
            iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
            if (iw * ih) > 0:
                has_rider = True
                break
        if has_rider:
            active_vehicles.append(("motorcycle", bb))

    for c in cars:
        active_vehicles.append(("car", c.xyxy[0].tolist()))

    # Full frame wrong side
    ws_res = ws_m.predict(img, conf=0.40, verbose=False)[0]
    ws_boxes = []
    rs_boxes = []
    if ws_res.boxes is not None:
        for b in ws_res.boxes:
            cls_name = ws_m.names[int(b.cls[0])]
            conf = float(b.conf[0])
            box = b.xyxy[0].tolist()
            if cls_name == "wrong-side":
                ws_boxes.append((conf, box))
            else:
                rs_boxes.append((conf, box))

    confirmed_ws = []
    for vtype, v_box in active_vehicles:
        # Check if v_box matches a wrong-side box
        matched_ws = None
        for ws_conf, ws_box in ws_boxes:
            ix1, iy1 = max(v_box[0], ws_box[0]), max(v_box[1], ws_box[1])
            ix2, iy2 = min(v_box[2], ws_box[2]), min(v_box[3], ws_box[3])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            a1 = (v_box[2] - v_box[0]) * (v_box[3] - v_box[1])
            a2 = (ws_box[2] - ws_box[0]) * (ws_box[3] - ws_box[1])
            iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
            cont = inter / min(a1, a2) if min(a1, a2) > 0 else 0
            if max(iou, cont) > 0.25:
                matched_ws = (ws_conf, ws_box)
                break

        if matched_ws:
            # Check if also matched right-side box with higher conf
            matched_rs = None
            for rs_conf, rs_box in rs_boxes:
                ix1, iy1 = max(v_box[0], rs_box[0]), max(v_box[1], rs_box[1])
                ix2, iy2 = min(v_box[2], rs_box[2]), min(v_box[3], rs_box[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                a1 = (v_box[2] - v_box[0]) * (v_box[3] - v_box[1])
                a2 = (rs_box[2] - rs_box[0]) * (rs_box[3] - rs_box[1])
                iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
                cont = inter / min(a1, a2) if min(a1, a2) > 0 else 0
                if max(iou, cont) > 0.25 and rs_conf >= matched_ws[0]:
                    matched_rs = (rs_conf, rs_box)
                    break

            if not matched_rs:
                # Also test vehicle crop
                x1, y1, x2, y2 = [int(v) for v in v_box]
                crop = img[max(0, y1):min(img.shape[0], y2), max(0, x1):min(img.shape[1], x2)]
                if crop.size > 0:
                    c_res = ws_m.predict(crop, conf=0.25, verbose=False)[0]
                    c_rs = []
                    c_ws = []
                    if c_res.boxes is not None:
                        c_rs = [float(cb.conf[0]) for cb in c_res.boxes if ws_m.names[int(cb.cls[0])] == "right-side"]
                        c_ws = [float(cb.conf[0]) for cb in c_res.boxes if ws_m.names[int(cb.cls[0])] == "wrong-side"]
                    # If crop strongly says right-side and no crop wrong-side, suppress
                    if c_rs and max(c_rs) >= 0.50 and not c_ws:
                        continue
                confirmed_ws.append((vtype, matched_ws[0]))
    return confirmed_ws


sample_dir = os.path.abspath(os.path.join(ml_service_dir, "..", "test-assets", "samples"))
ignore_prefixes = ("annotated_", "strip_", "angle", "car_plate", "moto_", "plate_", "white_plate", "debug_", "crop_")
images = [
    p for p in sorted(glob.glob(os.path.join(sample_dir, "*.jpg")))
    if not os.path.basename(p).startswith(ignore_prefixes)
]

print("=" * 80)
print("REFINED WRONG-SIDE EVALUATION ON IMAGES")
print("=" * 80)
for ip in images:
    name = os.path.basename(ip)
    im = cv2.imread(ip)
    if im is None:
        im = cv2.cvtColor(np.array(Image.open(ip).convert("RGB")), cv2.COLOR_RGB2BGR)
    res = evaluate_wrong_side(im)
    res_str = ", ".join([f"{v[0]} ({v[1]:.2f})" for v in res]) if res else "None"
    print(f"| {name:<18} | {res_str}")
print("=" * 80)
