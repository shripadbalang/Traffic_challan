import cv2
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.test_helpers import get_sample_path
from app.models_loader import get_plate_model
from app.config import settings

frame = cv2.imread(get_sample_path("img3.jpg"))
print("Image loaded, shape:", frame.shape if frame is not None else "FAILED TO LOAD")

model = get_plate_model()
print("Model loaded:", model is not None)

results = model.predict(frame, conf=0.05, verbose=False)

print(f"\nConfigured PLATE_CLASS_NAME: '{settings.PLATE_CLASS_NAME}'")
print(f"Configured PLATE_CONFIDENCE_THRESHOLD: {settings.PLATE_CONFIDENCE_THRESHOLD}")
print()

for result in results:
    names = result.names
    print("Boxes found:", len(result.boxes))
    for box in result.boxes:
        cls_id = int(box.cls[0])
        cls_name = names.get(cls_id, str(cls_id))
        conf = float(box.conf[0])
        matches_class = (cls_name == settings.PLATE_CLASS_NAME)
        passes_threshold = (conf >= settings.PLATE_CONFIDENCE_THRESHOLD)
        print(f"  Class: '{cls_name}' (matches config: {matches_class}), "
              f"Confidence: {conf:.3f} (passes threshold: {passes_threshold})")

        if matches_class and conf >= 0.05:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
            h, w = frame.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = frame[y1:y2, x1:x2]
            print(f"    Crop shape: {crop.shape}, saving to debug_crop.jpg")
            cv2.imwrite("debug_crop.jpg", crop)

            crop_big = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            gray = cv2.cvtColor(crop_big, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            cv2.imwrite("debug_crop_processed.jpg", gray)

            import easyocr
            reader = easyocr.Reader(["en"], gpu=True)
            ocr_results = reader.readtext(gray)
            print(f"    OCR raw results: {ocr_results}")