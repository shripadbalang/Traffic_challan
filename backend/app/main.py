from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, vehicles, violations, challans, payments, notifications, admin

app = FastAPI(
    title="Maharashtra Traffic E-Challan System",
    description="AI-Assisted Traffic Violation Detection and E-Challan Management System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve evidence images/receipts so the frontend can render them directly
app.mount("/files/evidence", StaticFiles(directory=settings.EVIDENCE_STORAGE_PATH), name="evidence")
app.mount("/files/receipts", StaticFiles(directory=settings.RECEIPT_STORAGE_PATH), name="receipts")

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(violations.router)
app.include_router(challans.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(admin.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "env": settings.ENV}


@app.get("/")
def root():
    return {"message": "Traffic E-Challan API is running. See /docs for API documentation."}
