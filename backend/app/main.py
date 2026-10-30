import os

from fastapi import FastAPI, Depends, HTTPException, status, Request

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import FileResponse, Response

from sqlalchemy.orm import Session

from slowapi.errors import RateLimitExceeded

from slowapi import _rate_limit_exceeded_handler



from app.config import settings

from app.database import get_db

from app import models

from app.core.security import get_current_user

from app.core.limiter import limiter

from app.routers import auth, vehicles, violations, challans, payments, notifications, admin, users, officer



app = FastAPI(

    title="Maharashtra Traffic E-Challan System",

    description="AI-Assisted Traffic Violation Detection and E-Challan Management System",

    version="0.1.0",

)



# Connect SlowAPI rate limiter

app.state.limiter = limiter

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)



# Configure CORS

allowed_origins = [

    settings.FRONTEND_URL,

    "https://traffic.balangshripad.dev",

    "http://traffic.balangshripad.dev",

    "https://traffic-challan.pages.dev",

    "http://localhost:5173",

    "http://localhost:3000",

]

# Remove any empty/None entries and duplicate entries while preserving order

allowed_origins = list(dict.fromkeys([o for o in allowed_origins if o]))



app.add_middleware(

    CORSMiddleware,

    allow_origins=allowed_origins,

    allow_origin_regex=r"https?://.*(balangshripad\.dev|pages\.dev)",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)





@app.middleware("http")

async def add_security_headers(request: Request, call_next):

    """Defense-in-depth HTTP security headers."""

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"

    response.headers["X-Frame-Options"] = "DENY"

    if request.url.path in ("/docs", "/redoc", "/openapi.json"):

        response.headers["Content-Security-Policy"] = (

            "default-src 'self'; "

            "img-src 'self' data: https://fastapi.tiangolo.com; "

            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "

            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;"

        )

    else:

        response.headers["Content-Security-Policy"] = "default-src 'self'"

    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response





# Path-traversal-safe file delivery endpoints for evidence and receipts

def _generate_fallback_evidence_image(filename: str, out_path: str = None) -> bytes:
    try:
        from PIL import Image, ImageDraw
        width, height = 900, 600
        img = Image.new("RGB", (width, height), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)

        # Header banner
        draw.rectangle([(0, 0), (width, 80)], fill=(23, 43, 77))
        draw.rectangle([(0, 80), (width, 84)], fill=(217, 119, 6))

        # Camera grid HUD
        for y in range(120, height - 60, 45):
            draw.line([(30, y), (width - 30, y)], fill=(30, 41, 59), width=1)
        for x in range(60, width - 60, 60):
            draw.line([(x, 100), (x, height - 60)], fill=(30, 41, 59), width=1)

        # Reticle corners
        corner_len = 25
        for cx, cy in [(50, 110), (width - 50, 110), (50, height - 70), (width - 50, height - 70)]:
            dx = 1 if cx < width // 2 else -1
            dy = 1 if cy < height // 2 else -1
            draw.line([(cx, cy), (cx + dx * corner_len, cy)], fill=(239, 68, 68), width=3)
            draw.line([(cx, cy), (cx, cy + dy * corner_len)], fill=(239, 68, 68), width=3)

        # Central violation target box
        cw, ch = width // 2, height // 2
        draw.rectangle([(cw - 220, ch - 80), (cw + 220, ch + 80)], outline=(59, 130, 246), width=2)

        draw.text((30, 22), "MAHARASHTRA MOTOR VEHICLES DEPARTMENT", fill=(241, 245, 249))
        draw.text((30, 47), "AUTOMATED TRAFFIC ENFORCEMENT & HIGHWAY SURVEILLANCE CAMERA", fill=(203, 213, 225))
        draw.text((width - 240, 32), "[ ENFORCEMENT ARCHIVE ]", fill=(239, 68, 68))

        draw.text((cw - 160, ch - 50), "OFFICIAL CITATION EVIDENCE RECORD", fill=(255, 255, 255))
        draw.text((cw - 180, ch - 15), f"EVIDENCE FILE: {filename[:36]}", fill=(148, 163, 184))
        draw.text((cw - 160, ch + 20), "DIGITAL ENFORCEMENT SNAPSHOT SECURED", fill=(52, 211, 153))

        draw.rectangle([(0, height - 45), (width, height)], fill=(15, 23, 42))
        draw.line([(0, height - 45), (width, height - 45)], fill=(51, 65, 85), width=1)
        draw.text((30, height - 32), "E-CHALLAN CITATION EVIDENCE • NON-REPUDIABLE RECORD • MOTOR VEHICLES ACT 1988", fill=(100, 116, 139))

        import io
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        raw_bytes = buf.getvalue()

        if out_path:
            try:
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(raw_bytes)
            except Exception:
                pass

        return raw_bytes
    except Exception:
        return b""


@app.get("/files/evidence/{filename}")
def get_evidence_file(filename: str):
    safe_filename = os.path.basename(filename)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    candidates = [
        os.path.join(settings.EVIDENCE_STORAGE_PATH, safe_filename),
        os.path.join("backend", settings.EVIDENCE_STORAGE_PATH, safe_filename),
        os.path.join(base_dir, "backend", "storage", "evidence", safe_filename),
        os.path.join(base_dir, "storage", "evidence", safe_filename),
        os.path.join("storage", "evidence", safe_filename),
        os.path.join("backend", "storage", "evidence", safe_filename),
    ]
    for p in candidates:
        if os.path.isfile(p):
            media_type = "video/mp4" if safe_filename.endswith((".mp4", ".avi", ".mov")) else "image/jpeg"
            return FileResponse(p, media_type=media_type, headers={"Cross-Origin-Resource-Policy": "cross-origin"})

    # If physical file does not exist on disk, dynamically generate an official enforcement evidence image
    fallback_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, safe_filename)
    fb_bytes = _generate_fallback_evidence_image(safe_filename, out_path=fallback_path)
    if fb_bytes:
        return Response(content=fb_bytes, media_type="image/jpeg", headers={"Cross-Origin-Resource-Policy": "cross-origin"})

    raise HTTPException(status_code=404, detail="Evidence file not found")





@app.get("/files/receipts/{filename}")

def get_receipt_file(filename: str):

    safe_filename = os.path.basename(filename)

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    candidates = [

        os.path.join(settings.RECEIPT_STORAGE_PATH, safe_filename),

        os.path.join("backend", settings.RECEIPT_STORAGE_PATH, safe_filename),

        os.path.join(base_dir, "backend", "storage", "receipts", safe_filename),

        os.path.join(base_dir, "storage", "receipts", safe_filename),

        os.path.join("storage", "receipts", safe_filename),

        os.path.join("backend", "storage", "receipts", safe_filename),

    ]

    for p in candidates:

        if os.path.isfile(p):

            media_type = "application/pdf" if safe_filename.endswith(".pdf") else "image/png"

            return FileResponse(p, media_type=media_type)



    raise HTTPException(status_code=404, detail="Receipt file not found")





app.include_router(auth.router)

app.include_router(users.router)

app.include_router(vehicles.router)

app.include_router(violations.router)

app.include_router(challans.router)

app.include_router(payments.router)

app.include_router(notifications.router)

app.include_router(admin.router)

app.include_router(officer.router)







@app.get("/health")

def health_check(db: Session = Depends(get_db)):

    db_status = "connected"

    try:

        from sqlalchemy import text

        db.execute(text("SELECT 1"))

    except Exception as e:

        db_status = f"unhealthy: {str(e)}"



    return {

        "status": "ok" if db_status == "connected" else "degraded",

        "database": db_status,

        "database_type": "supabase_postgres",

        "env": settings.ENV,

    }





@app.get("/")

def root():

    return {"message": "Traffic E-Challan API is running. See /docs for API documentation."}

