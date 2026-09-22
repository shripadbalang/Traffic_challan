"""
Client for the ML inference microservice (separate FastAPI service running your
trained YOLO models for helmet / wrong-side / triple-riding / ANPR).

Expected contract for the ml-service's POST /detect endpoint:

  Request: multipart/form-data with a single "file" field (image or video)

  Response JSON:
  {
    "violations_found": ["no_helmet", "triple_riding"],
    "plate_number": "MH12AB1234",
    "plate_confidence": 0.91,
    "boxes": [
      {"class_name": "no_helmet", "confidence": 0.87, "bbox": [120, 45, 260, 210]},
      ...
    ],
    "annotated_file_path": "annotated/xyz.jpg"   # optional, ml-service can save its own annotated copy
  }

Adjust field names here if your ml-service's actual response shape differs —
this is the single integration point, so once your ml-service is running,
only this file (and the DetectionResult schema) needs updating.
"""

import httpx
from fastapi import HTTPException

from app.config import settings
from app.schemas import DetectionResult


async def run_detection(file_bytes: bytes, filename: str, content_type: str) -> DetectionResult:
    url = f"{settings.ML_SERVICE_URL}/detect"
    files = {"file": (filename, file_bytes, content_type)}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, files=files)
            response.raise_for_status()
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"ML inference service unreachable: {exc}. "
                   f"Make sure ml-service is running at {settings.ML_SERVICE_URL}.",
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"ML service error: {exc.response.text}")

    data = response.json()
    return DetectionResult(**data)
