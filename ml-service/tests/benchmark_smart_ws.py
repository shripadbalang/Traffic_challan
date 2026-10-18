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

gen_m = YOLO("models/yolo11n.pt")
pose_m = YOLO("models/yolo11n-pose.pt")
ws_m = YOLO("models/wrong_side_best.pt")


def detect_wrong_side_smart(img):
    """
    Smart Wrong-Side Detection combining:
    1. Vehicle & Rider Detection (YOLO11)
    2. Rider Facing Direction / Keypoints (YOLO11-Pose)
    3. Dominant Traffic Flow comparison
    4. Specialized Wrong-Side Model (with right-side competition)
    """
    h, w, _ = img.shape

    # 1. Detect vehicles and persons
    gen_res = gen_m.predict(img, conf=0.25, verbose=False)[0]
    bikes = []
    persons = []
    cars = []

    for b in gen_res.boxes:
        cid = int(b.cls[0])
        box = b.xyxy[0].tolist()
        conf = float(b.conf[0])
        if cid == 3:  # motorcycle
            bikes.append({"bbox": box, "conf": conf})
        elif cid == 0:  # person
            persons.append({"bbox": box, "conf": conf})
        elif cid in (1, 2, 5, 7):  # bicycle, car, bus, truck
            cars.append({"bbox": box, "conf": conf, "type": gen_m.names[cid]})

    # 2. Match riders to motorcycles
    active_bikes = []
    for b in bikes:
        bb = b["bbox"]
        associated_people = []
        for p in persons:
            pb = p["bbox"]
            ix1, iy1 = max(bb[0], pb[0]), max(bb[1], pb[1])
            ix2, iy2 = min(bb[2], pb[2]), min(bb[3], pb[3])
            iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
            inter = iw * ih
            a1 = (bb[2] - bb[0]) * (bb[3] - bb[1])
            a2 = (pb[2] - pb[0]) * (pb[3] - pb[1])
            iou = inter / (a1 + a2 - inter) if (a1 + a2 - inter) > 0 else 0
            cont = inter / min(a1, a2) if min(a1, a2) > 0 else 0
            if iou >= 0.08 or cont >= 0.25:
                associated_people.append(p)
        if len(associated_people) >= 1:
            active_bikes.append({"bbox": bb, "conf": b["conf"], "riders": associated_people})

    # 3. Pose estimation for active riders
    pose_res = pose_m.predict(img, conf=0.25, verbose=False)[0]
    rider_headings = []  # "ONCOMING" or "OUTGOING"

    for ab in active_bikes:
        bb = ab["bbox"]
        # Find corresponding pose keypoints inside or overlapping this bike/rider
        best_heading = None
        for i, kp in enumerate(pose_res.keypoints):
            pbox = pose_res.boxes[i].xyxy[0].tolist()
            # Check overlap with bike or rider
            ix1, iy1 = max(bb[0], pbox[0]), max(bb[1], pbox[1])
            ix2, iy2 = min(bb[2], pbox[2]), min(bb[3], pbox[3])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            p_area = (pbox[2] - pbox[0]) * (pbox[3] - pbox[1])
            if p_area > 0 and (inter / p_area) > 0.20:
                pts = kp.data[0].tolist()
                face_confs = [pts[k][2] for k in range(3)]  # nose, left eye, right eye
                is_oncoming = any(c > 0.55 for c in face_confs) or (sum(face_confs) / 3.0 > 0.35)
                best_heading = "ONCOMING" if is_oncoming else "OUTGOING"
                break
        ab["heading"] = best_heading
        if best_heading:
            rider_headings.append(best_heading)

    # 4. Determine dominant traffic flow
    oncoming_count = rider_headings.count("ONCOMING")
    outgoing_count = rider_headings.count("OUTGOING")

    # 5. Run specialized wrong_side_model
    ws_res = ws_m.predict(img, conf=0.35, verbose=False)[0]
    ws_boxes = []
    rs_boxes = []
    if ws_res.boxes is not None:
        for b in ws_res.boxes:
            cname = ws_m.names[int(b.cls[0])]
            cconf = float(b.conf[0])
            cbox = b.xyxy[0].tolist()
            if cname == "wrong-side":
                ws_boxes.append((cconf, cbox))
            else:
                rs_boxes.append((cconf, cbox))

    wrong_side_violations = []

    # Evaluate active two-wheelers
    for ab in active_bikes:
        bb = ab["bbox"]
        heading = ab.get("heading")

        # Condition A: Vehicle is heading ONCOMING while dominant flow is OUTGOING (e.g. 12.jpg)
        if heading == "ONCOMING" and outgoing_count >= 2:
            wrong_side_violations.append({
                "class_name": "wrong_side",
                "confidence": 0.85,
                "bbox": bb,
                "reason": "Vehicle heading ONCOMING directly against dominant OUTGOING traffic flow",
            })
            continue

        # Condition B: Specialized model flags wrong-side and agrees with heading or high confidence
        matched_ws = None
        for cconf, cbox in ws_boxes:
            ix1, iy1 = max(bb[0], cbox[0]), max(bb[1], cbox[1])
            ix2, iy2 = min(bb[2], cbox[2]), min(bb[3], cbox[3])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            a1 = (bb[2] - bb[0]) * (bb[3] - bb[1])
            a2 = (cbox[2] - cbox[0]) * (cbox[3] - cbox[1])
            score = inter / min(a1, a2) if min(a1, a2) > 0 else 0
            if score > 0.25:
                matched_ws = (cconf, cbox)
                break

        if matched_ws:
            # Check right-side competition
            matched_rs = None
            for rconf, rbox in rs_boxes:
                ix1, iy1 = max(bb[0], rbox[0]), max(bb[1], rbox[1])
                ix2, iy2 = min(bb[2], rbox[2]), min(bb[3], rbox[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                a1 = (bb[2] - bb[0]) * (bb[3] - bb[1])
                a2 = (rbox[2] - rbox[0]) * (rbox[3] - rbox[1])
                score = inter / min(a1, a2) if min(a1, a2) > 0 else 0
                if score > 0.25 and rconf >= matched_ws[0]:
                    matched_rs = (rconf, rbox)
                    break

            # If vehicle is heading OUTGOING in a stream of OUTGOING traffic, suppress (normal flow)
            if heading == "OUTGOING" and outgoing_count >= 1:
                continue

            if not matched_rs and (matched_ws[0] >= 0.65 or heading == "ONCOMING"):
                wrong_side_violations.append({
                    "class_name": "wrong_side",
                    "confidence": matched_ws[0],
                    "bbox": bb,
                    "reason": f"Model classified as wrong-side (conf={matched_ws[0]:.2f})",
                })

    return wrong_side_violations


# Test on all images in test-assets/samples/
sample_dir = os.path.abspath(os.path.join(ml_service_dir, "..", "test-assets", "samples"))
ignore_prefixes = ("annotated_", "strip_", "angle", "car_plate", "moto_", "plate_", "white_plate", "debug_", "crop_")
images = [
    p for p in sorted(glob.glob(os.path.join(sample_dir, "*.jpg")))
    if not os.path.basename(p).startswith(ignore_prefixes)
]

print("=" * 85)
print("SMART WRONG-SIDE DETECTION BENCHMARK")
print("=" * 85)
for ip in images:
    name = os.path.basename(ip)
    im = cv2.imread(ip)
    if im is None:
        im = cv2.cvtColor(np.array(Image.open(ip).convert("RGB")), cv2.COLOR_RGB2BGR)
    viols = detect_wrong_side_smart(im)
    v_str = ", ".join([f"{v['class_name']} ({v['confidence']:.2f})" for v in viols]) if viols else "None"
    print(f"| {name:<18} | {v_str:<30} | {viols[0]['reason'] if viols else ''}")
print("=" * 85)
