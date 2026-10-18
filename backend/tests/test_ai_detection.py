import os
import sys
import requests

BASE_URL = "http://127.0.0.1:8000"
default_sample = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-assets", "samples", "test_image.jpg"))
image_path = sys.argv[1] if len(sys.argv) > 1 else (default_sample if os.path.exists(default_sample) else "test_image.jpg")


def step(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


# 1. Officer login
step("1. Officer login")
r = requests.post(f"{BASE_URL}/auth/login", json={
    "identifier": "officer1@echallan.gov.in",
    "password": "Officer@123"
}, timeout=15)
print(r.status_code, r.text)
officer_token = r.json().get("access_token")

# 2. Upload image to AI detection endpoint
step("2. Upload image for AI detection")
headers = {"Authorization": f"Bearer {officer_token}"}
with open(image_path, "rb") as f:
    files = {"file": (image_path, f, "image/jpeg")}
    data = {"location": "FC Road, Pune", "latitude": "18.5204", "longitude": "73.8567"}
    r = requests.post(f"{BASE_URL}/violations/detect", headers=headers, files=files, data=data, timeout=60)
print(r.status_code, r.text)