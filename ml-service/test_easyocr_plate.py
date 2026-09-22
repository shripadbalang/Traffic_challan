import cv2
import easyocr

img = cv2.imread("production_plate_crop.jpg")

reader = easyocr.Reader(["en"], gpu=True)

result = reader.readtext(img)

print("\n===== EASY OCR RESULT =====")

for detection in result:
    print(detection)