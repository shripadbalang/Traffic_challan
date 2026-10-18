import cv2
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.test_helpers import get_sample_path
from app.detect import _run_plate_model

frame = cv2.imread(get_sample_path("img3.jpg"))
if frame is None:
    print("Could not load image — check the filename/path.")
else:
    result = _run_plate_model(frame)
    print("Raw plate detection + OCR result:")
    print(result)