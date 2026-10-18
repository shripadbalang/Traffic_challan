import os
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
allowed_origins = [settings.FRONTEND_URL]
if settings.ENV in ("development", "test"):
    for dev_origin in ["http://localhost:5173", "http://localhost:3000"]:
        if dev_origin not in allowed_origins:
            allowed_origins.append(dev_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
@app.get("/files/evidence/{filename}")
def get_evidence_file(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, safe_filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Evidence file not found")

    media_type = "video/mp4" if safe_filename.endswith((".mp4", ".avi", ".mov")) else "image/jpeg"
    return FileResponse(file_path, media_type=media_type)


@app.get("/files/receipts/{filename}")
def get_receipt_file(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.RECEIPT_STORAGE_PATH, safe_filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Receipt file not found")

    media_type = "application/pdf" if safe_filename.endswith(".pdf") else "image/png"
    return FileResponse(file_path, media_type=media_type)


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
