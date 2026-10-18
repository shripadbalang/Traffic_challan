from fast_plate_ocr import LicensePlateRecognizer

m = LicensePlateRecognizer('cct-s-v2-global-model')

result = m.run('debug_bike_crop.jpg', return_confidence=True)
print("Full result:", result)

pred = result[0]
print("\nPlate:", pred.plate)
print("Length of predicted plate:", len(pred.plate))
print("All attributes:", dir(pred))