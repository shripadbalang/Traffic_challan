from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class CitizenSignupRequest(BaseModel):
    full_name: str
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    plate_number: str
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6)


class OtpRequest(BaseModel):
    mobile_number: str


class OtpVerifyRequest(BaseModel):
    mobile_number: str
    code: str


class LoginRequest(BaseModel):
    identifier: str  # email or mobile_number
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# ---------- Vehicle / Mock Vahan ----------
class VehicleOut(BaseModel):
    id: str
    plate_number: str
    vehicle_type: str
    model: Optional[str]
    rto_code: Optional[str]
    owner_name: Optional[str]

    class Config:
        from_attributes = True


# ---------- Violation detection ----------
class DetectionBox(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]


class DetectionResult(BaseModel):
    violations_found: List[str]
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    boxes: List[DetectionBox] = []
    annotated_file_path: Optional[str] = None


# ---------- Challan ----------
class ChallanCreateManual(BaseModel):
    plate_number: str
    violation_code: str
    location: Optional[str] = None
    notes: Optional[str] = None


class ChallanOut(BaseModel):
    id: str
    vehicle_id: str
    violation_type_id: str
    detection_source: str
    fine_amount: float
    status: str
    ai_confidence_score: Optional[float]
    violation_datetime: datetime
    location: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Payment ----------
class PaymentInitiateRequest(BaseModel):
    challan_id: str


class PaymentVerifyRequest(BaseModel):
    challan_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ---------- Admin analytics ----------
class AnalyticsOverview(BaseModel):
    total_challans: int
    total_revenue: float
    pending_count: int
    paid_count: int
    disputed_count: int
