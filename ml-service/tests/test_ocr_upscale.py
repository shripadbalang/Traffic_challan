import cv2
from fast_plate_ocr import LicensePlateRecognizer

img = cv2.imread("production_plate_crop.jpg")

ocr = LicensePlateRecognizer("cct-s-v2-global-model")

for scale in [1, 2, 4]:
    resized = cv2.resize(
        img,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC
    )

    filename = f"ocr_test_{scale}x.jpg"
    cv2.imwrite(filename, resized)

    result = ocr.run(filename, return_confidence=True)

    print(f"\n===== {scale}X =====")
    print(result)

    if result:
        print("Plate:", result[0].plate)
        print("Character probabilities:", result[0].char_probs)