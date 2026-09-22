from ultralytics import YOLO

model = YOLO("models/triple_riding_best.pt")
results = model.predict("2.jpg", conf=0.05, verbose=True)

for result in results:
    print("Number of boxes detected:", len(result.boxes))
    for box in result.boxes:
        cls_id = int(box.cls[0])
        cls_name = result.names[cls_id]
        conf = float(box.conf[0])
        print(f"  Class: {cls_name}, Confidence: {conf:.3f}")