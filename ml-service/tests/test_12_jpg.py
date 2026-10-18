import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

gen = YOLO("ml-service/models/yolo11n.pt")
hel = YOLO("ml-service/models/helmet_best.pt")
ws = YOLO("ml-service/models/wrong_side_best.pt")
plt = YOLO("ml-service/models/numberplate_best.pt")

ip = "test-assets/samples/12.jpg"
img = cv2.imread(ip)
if img is None:
    img = cv2.cvtColor(np.array(Image.open(ip).convert("RGB")), cv2.COLOR_RGB2BGR)

print(f"Image shape: {img.shape}")

# General model
gres = gen.predict(img, conf=0.25, verbose=False)[0]
print("=== GENERAL DETECTIONS ===")
for b in gres.boxes:
    cid = int(b.cls[0])
    cname = gen.names[cid]
    conf = float(b.conf[0])
    box = [round(x, 1) for x in b.xyxy[0].tolist()]
    if cid in (0, 1, 2, 3, 5, 7):
        print(f"  {cname} ({conf:.2f}): {box}")

# Wrong side model at various confidences
print("=== WRONG SIDE MODEL DETECTIONS ===")
for conf_thr in (0.05, 0.10, 0.15, 0.20, 0.30, 0.40):
    wres = ws.predict(img, conf=conf_thr, verbose=False)[0]
    preds = []
    if wres.boxes is not None:
        for b in wres.boxes:
            preds.append(f"{ws.names[int(b.cls[0])]}({float(b.conf[0]):.3f}) at {[round(x, 1) for x in b.xyxy[0].tolist()]}")
    print(f"  conf={conf_thr:.2f}: {preds if preds else 'None'}")

# Helmet model
hres = hel.predict(img, conf=0.25, verbose=False)[0]
print("=== HELMET MODEL DETECTIONS ===")
if hres.boxes is not None:
    for b in hres.boxes:
        cid = int(b.cls[0])
        cname = hel.names[cid]
        conf = float(b.conf[0])
        box = [round(x, 1) for x in b.xyxy[0].tolist()]
        print(f"  {cname} ({conf:.2f}): {box}")

# Plate model
pres = plt.predict(img, conf=0.10, verbose=False)[0]
print("=== PLATE MODEL DETECTIONS ===")
if pres.boxes is not None:
    for b in pres.boxes:
        conf = float(b.conf[0])
        box = [round(x, 1) for x in b.xyxy[0].tolist()]
        print(f"  plate ({conf:.2f}): {box}")
