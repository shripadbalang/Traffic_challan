# Traffic Violation ML Inference Service

This is a separate microservice from the main backend. It runs your 4 trained
YOLO models (helmet, wrong-side, triple-riding, plate) and exposes one endpoint,
`POST /detect`, that the main backend calls automatically.

## Setup

1. **Place your trained model files** in the `models/` folder, named exactly:
   ```
   models/helmet.pt
   models/wrong_side.pt
   models/triple_riding.pt
   models/plate.pt
   ```
   (Or edit the paths in `app/config.py` if you'd rather keep your own file names/locations.)

2. **Create a virtual environment and install dependencies:**
   ```
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
   Note: `ultralytics` and `easyocr` are large installs (they pull in PyTorch) —
   this may take 5-10 minutes and a few GB of disk space. If you already have
   PyTorch with CUDA installed for training, that same install can be reused
   here so detection runs on your RTX 3060 instead of CPU.

3. **Find your models' real class names** — this is the most important step,
   since your training labels might not exactly match our defaults. For each
   model, run:
   ```
   python -c "from ultralytics import YOLO; print(YOLO('models/helmet.pt').names)"
   ```
   This prints something like `{0: 'helmet', 1: 'no_helmet'}`. Find the class
   name that means "violation detected" (not the compliant/safe case) and note it.

   Repeat for `wrong_side.pt`, `triple_riding.pt`, and `plate.pt`.

4. **Update `app/config.py`** with your actual class names, e.g.:
   ```python
   HELMET_VIOLATION_CLASS_NAME: str = "no_helmet"       # <- your model's real class name
   WRONG_SIDE_VIOLATION_CLASS_NAME: str = "wrong_side"   # <- your model's real class name
   TRIPLE_RIDING_VIOLATION_CLASS_NAME: str = "triple_riding"
   PLATE_CLASS_NAME: str = "license_plate"
   ```

5. **Run the service** (in its own separate window, same pattern as the backend):
   ```
   uvicorn app.main:app --port 8001
   ```
   Watch the startup logs — each model prints its class names again when loaded,
   as a final sanity check that config.py matches reality.

## Testing it standalone

Once running, test with a single image before connecting it to the main backend:

```python
import requests
with open("test_image.jpg", "rb") as f:
    r = requests.post("http://127.0.0.1:8001/detect", files={"file": f})
print(r.json())
```

Expected response shape:
```json
{
  "violations_found": ["no_helmet"],
  "plate_number": "MH12AB1234",
  "plate_confidence": 0.91,
  "boxes": [{"class_name": "no_helmet", "confidence": 0.87, "bbox": [120, 45, 260, 210]}],
  "annotated_file_path": null
}
```

## Connecting to the main backend

In the main backend's `.env`, confirm:
```
ML_SERVICE_URL=http://localhost:8001
```
That's it — the backend's `app/services/ml_client.py` already calls this exact
`/detect` contract. With both services running (backend on :8000, ml-service on
:8001), the `POST /violations/detect` endpoint on the backend will now trigger
real detections and auto-create challans.

## Notes on the "wrong-side driving" model

The original project plan discussed a tracking-based approach (YOLO + ByteTrack
+ direction inference) for wrong-side detection, since it's normally hard to
detect from a single frame. Since you've already trained a standalone model for
it, this service treats it like the other three (single-frame classification) —
simpler, and respects the model you've actually built. If its accuracy on video
turns out to be limited, the tracking-based approach remains a documented
"future improvement" you can mention in your report.
