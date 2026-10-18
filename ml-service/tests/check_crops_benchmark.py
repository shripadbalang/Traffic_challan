import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

ws_m = YOLO("ml-service/models/wrong_side_best.pt")
gen_m = YOLO("ml-service/models/yolo11n.pt")

for name in ("6.jpg", "2.jpg", "image.jpg", "7.jpg", "10.jpg", "11.jpg"):
    ip = f"test-assets/samples/{name}"
    img = cv2.imread(ip)
    if img is None:
        img = cv2.cvtColor(np.array(Image.open(ip).convert("RGB")), cv2.COLOR_RGB2BGR)

    gen_res = gen_m.predict(img, conf=0.30, verbose=False)[0]
    print(f"=== {name} ===")
    for b in gen_res.boxes:
        cls_id = int(b.cls[0])
        cname = gen_m.names[cls_id]
        if cls_id not in (1, 2, 3, 5, 7):
            continue
        x1, y1, x2, y2 = [int(x) for x in b.xyxy[0].tolist()]
        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        crop_res = ws_m.predict(crop, conf=0.15, verbose=False)[0]
        preds = []
        if crop_res.boxes is not None:
            for cb in crop_res.boxes:
                preds.append(f"{ws_m.names[int(cb.cls[0])]}({float(cb.conf[0]):.2f})")
        print(f"  {cname} at [{x1},{y1},{x2},{y2}]: {preds if preds else 'None'}")
