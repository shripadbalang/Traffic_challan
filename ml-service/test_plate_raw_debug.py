import cv2
from app.detect import _run_plate_model

frame = cv2.imread("images.jpg")
result = _run_plate_model(frame)
print("Raw plate detection + OCR result:")
print(result)