from fastapi import FastAPI, UploadFile, File, HTTPException

from app.models_loader import preload_all
from app.detect import process_image, process_video

app = FastAPI(title="Traffic Violation ML Inference Service", version="0.1.0")

IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}
VIDEO_TYPES = {"video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"}


@app.on_event("startup")
def startup():
    print("[ml-service] Preloading models at startup...")
    preload_all()
    print("[ml-service] Ready.")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    content_type = file.content_type
    file_bytes = await file.read()

    try:
        if content_type in IMAGE_TYPES:
            result = process_image(file_bytes)
        elif content_type in VIDEO_TYPES:
            result = process_video(file_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported content type: {content_type}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result
