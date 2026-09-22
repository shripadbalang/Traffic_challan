from ultralytics import YOLO

model = YOLO("models/numberplate_best.pt")
results = model.predict("images.jpg", conf=0.05, verbose=True)

for result in results:
    print("Number of boxes detected:", len(result.boxes))
    for box in result.boxes:
        cls_id = int(box.cls[0])
        cls_name = result.names[cls_id]
        conf = float(box.conf[0])
        bbox = [float(v) for v in box.xyxy[0]]
        print(f"  Class: '{cls_name}', Confidence: {conf:.3f}, BBox: {bbox}")