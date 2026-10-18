import os
import sys
import requests

default_sample = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-assets", "samples", "test_image.jpg"))
image_path = sys.argv[1] if len(sys.argv) > 1 else (default_sample if os.path.exists(default_sample) else "test_image.jpg")

with open(image_path, "rb") as f:
    r = requests.post("http://127.0.0.1:8001/detect", files={"file": (image_path, f, "image/jpeg")})

print("Status:", r.status_code)
print(r.json())