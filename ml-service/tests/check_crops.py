import cv2
import os
from ultralytics import YOLO

ws_m = YOLO("ml-service/models/wrong_side_best.pt")
gen_m = YOLO("ml-service/models/yolo11n.pt")

cap = cv2.VideoCapture("test-assets/samples/test.mp4")
for fno in (45, 105, 135, 150, 225, 255):
    cap.set(cv2.CAP_PROP_POS_FRAMES, fno - 1)
    ret, frame = cap.read()
    gen_res = gen_m.predict(frame, conf=0.35, verbose=False)[0]
    print(f"=== FRAME {fno} ===")
    for b in gen_res.boxes:
        cls_id = int(b.cls[0])
        cname = gen_m.names[cls_id]
        if cls_id not in (1, 2, 3, 5, 7):
            continue
        x1, y1, x2, y2 = [int(x) for x in b.xyxy[0].tolist()]
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        crop_res = ws_m.predict(crop, conf=0.15, verbose=False)[0]
        preds = []
        if crop_res.boxes is not None:
            for cb in crop_res.boxes:
                preds.append(f"{ws_m.names[int(cb.cls[0])]}({float(cb.conf[0]):.2f})")
        print(f"  {cname} at [{x1},{y1},{x2},{y2}]: {preds if preds else 'None'}")
