import cv2
from app.detect import _run_plate_model

frame = cv2.imread("img3.jpg")
if frame is None:
    print("Could not load image — check the filename/path.")
else:
    result = _run_plate_model(frame)
    print("Raw plate detection + OCR result:")
    print(result)