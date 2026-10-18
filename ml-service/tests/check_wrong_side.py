import glob
import os
import sys
import cv2
import numpy as np
from PIL import Image

# Ensure ml-service root is in sys.path
ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

from ultralytics import YOLO
from app.config import settings

model_path = os.path.join(ml_service_dir, "models", "wrong_side_best.pt")
model = YOLO(model_path)

sample_dir = os.path.abspath(os.path.join(ml_service_dir, "..", "test-assets", "samples"))
ignore_prefixes = ("annotated_", "strip_", "angle", "car_plate", "moto_", "plate_", "white_plate", "debug_", "crop_")
images = [
    p for p in sorted(glob.glob(os.path.join(sample_dir, "*.jpg")))
    if not os.path.basename(p).startswith(ignore_prefixes)
]

print("=" * 80)
print(f"WRONG SIDE MODEL EVALUATION (Threshold = {settings.CONFIDENCE_THRESHOLD})")
print("=" * 80)

for img_path in images:
    name = os.path.basename(img_path)
    img = cv2.imread(img_path)
    if img is None:
        pil_img = Image.open(img_path).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    results = model.predict(img, conf=0.20, verbose=False)[0]
    preds = []
    if results.boxes is not None:
        for b in results.boxes:
            cname = model.names[int(b.cls[0])]
            conf = float(b.conf[0])
            box = [round(x, 1) for x in b.xyxy[0].tolist()]
            preds.append(f"{cname} ({conf:.2f})")

    res_str = ", ".join(preds) if preds else "None"
    print(f"| {name:<18} | {res_str}")

print("=" * 80)
