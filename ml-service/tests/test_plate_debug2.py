import os
import sys
from ultralytics import YOLO

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.test_helpers import get_sample_path, ML_SERVICE_ROOT

model_path = os.path.join(ML_SERVICE_ROOT, "models", "numberplate_best.pt")
model = YOLO(model_path)
results = model.predict(get_sample_path("images.jpg"), conf=0.05, verbose=True)

for result in results:
    print("Number of boxes detected:", len(result.boxes))
    for box in result.boxes:
        cls_id = int(box.cls[0])
        cls_name = result.names[cls_id]
        conf = float(box.conf[0])
        bbox = [float(v) for v in box.xyxy[0]]
        print(f"  Class: '{cls_name}', Confidence: {conf:.3f}, BBox: {bbox}")