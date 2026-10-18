import cv2
import os
import sys
from ultralytics import YOLO

ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

pose_m = YOLO("yolo11n-pose.pt")
img = cv2.imread("../test-assets/samples/12.jpg")
res = pose_m.predict(img, conf=0.30, verbose=False)[0]

print(f"Pose keypoints detected for {len(res.keypoints)} people in 12.jpg:")
for i, kp in enumerate(res.keypoints):
    box = [round(x, 1) for x in res.boxes[i].xyxy[0].tolist()]
    pts = kp.data[0].tolist()
    face_confs = [pts[k][2] for k in range(5)]
    avg_face_conf = sum(face_confs) / 5.0
    has_face = avg_face_conf > 0.35 or any(c > 0.55 for c in face_confs[:3])
    facing = "TOWARDS CAMERA (ONCOMING)" if has_face else "AWAY FROM CAMERA (OUTGOING)"
    print(f"Person {i} at {box}: face_confs={[round(c, 2) for c in face_confs]} -> {facing}")
