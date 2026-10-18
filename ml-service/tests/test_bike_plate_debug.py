import cv2
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.test_helpers import get_sample_path
from app.models_loader import get_plate_model
from app.config import settings
from app.detect import _preprocess_plate_crop, _clean_plate_text, _autocorrect_plate

frame = cv2.imread(get_sample_path("bike_plate.jpg"))
model = get_plate_model()
results = model.predict(frame, conf=0.05, verbose=False)

for result in results:
    for box in result.boxes:
        conf = float(box.conf[0])
        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
        print(f"Box confidence: {conf:.3f}, bbox: [{x1},{y1},{x2},{y2}]")

        h, w = frame.shape[:2]
        box_w, box_h = x2 - x1, y2 - y1
        pad_x, pad_y = int(box_w * 0.15), int(box_h * 0.25)
        x1p, y1p = max(0, x1 - pad_x), max(0, y1 - pad_y)
        x2p, y2p = min(w, x2 + pad_x), min(h, y2 + pad_y)
        crop = frame[y1p:y2p, x1p:x2p]
        print("Crop shape:", crop.shape)
        cv2.imwrite("debug_bike_crop.jpg", crop)

        gray_enhanced, binary = _preprocess_plate_crop(crop)
        cv2.imwrite("debug_bike_gray.jpg", gray_enhanced)
        cv2.imwrite("debug_bike_binary.jpg", binary)

        import easyocr
        reader = easyocr.Reader(["en"], gpu=True)

        print("\n--- OCR on grayscale-enhanced version ---")
        r1 = reader.readtext(gray_enhanced)
        print(r1)
        if r1:
            text1 = _clean_plate_text("".join([x[1] for x in r1]))
            print("Cleaned:", text1, "| Auto-corrected:", _autocorrect_plate(text1))

        print("\n--- OCR on binarized version ---")
        r2 = reader.readtext(binary)
        print(r2)
        if r2:
            text2 = _clean_plate_text("".join([x[1] for x in r2]))
            print("Cleaned:", text2, "| Auto-corrected:", _autocorrect_plate(text2))
        print("=" * 50)