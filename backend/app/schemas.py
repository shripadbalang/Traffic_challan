import re
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, field_validator


def clean_mobile_str(val: Any) -> Any:
    if isinstance(val, str):
        cleaned = re.sub(r"\D", "", val)
        if cleaned.startswith("91") and len(cleaned) > 10:
            cleaned = cleaned[2:]
        elif cleaned.startswith("0") and len(cleaned) > 10:
            cleaned = re.sub(r"^0+", "", cleaned)
        return cleaned
    return val


def clean_identifier_str(val: Any) -> Any:
    if isinstance(val, str):
        val = val.strip()
        if "@" not in val:
            cleaned = re.sub(r"\D", "", val)
            if cleaned.startswith("91") and len(cleaned) > 10:
                cleaned = cleaned[2:]
            elif cleaned.startswith("0") and len(cleaned) > 10:
                cleaned = re.sub(r"^0+", "", cleaned)
            return cleaned
        return val.lower()
    return val


# ---------- Auth ----------
class CitizenSignupRequest(BaseModel):
    full_name: str
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    plate_number: str
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6)

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OwnerSignupInitiateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OwnerSignupVerifyRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OwnerLoginInitiateRequest(BaseModel):
    identifier: str = Field(..., min_length=3)  # Email or 10-digit mobile number

    @field_validator("identifier", mode="before")
    @classmethod
    def clean_id(cls, v: Any) -> Any:
        return clean_identifier_str(v)


class OwnerLoginVerifyRequest(BaseModel):
    identifier: str = Field(..., min_length=3)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("identifier", mode="before")
    @classmethod
    def clean_id(cls, v: Any) -> Any:
        return clean_identifier_str(v)


class OwnerResendOtpRequest(BaseModel):
    identifier: str = Field(..., min_length=3)

    @field_validator("identifier", mode="before")
    @classmethod
    def clean_id(cls, v: Any) -> Any:
        return clean_identifier_str(v)


class OwnerProfileSyncRequest(BaseModel):
    user_id: str = Field(..., min_length=10, max_length=64)
    email: EmailStr
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class AddVehicleRequest(BaseModel):
    vehicle_number: str = Field(..., min_length=4, max_length=20)
    registered_mobile: str = Field(..., pattern=r"^\d{10}$")

    @field_validator("registered_mobile", mode="before")
    @classmethod
    def clean_reg_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OtpRequest(BaseModel):
    mobile_number: str

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OtpVerifyRequest(BaseModel):
    mobile_number: str
    code: Optional[str] = None
    otp: Optional[str] = None

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OwnerOtpRequest(BaseModel):
    vehicle_number: str
    mobile_number: str

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class OwnerOtpVerifyRequest(BaseModel):
    vehicle_number: str
    mobile_number: str
    code: str

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class LoginRequest(BaseModel):
    identifier: str  # email or mobile_number
    password: str

    @field_validator("identifier", mode="before")
    @classmethod
    def clean_id(cls, v: Any) -> Any:
        return clean_identifier_str(v)
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Optional[dict] = None


class UserProfileOut(BaseModel):
    id: str
    full_name: str
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    role: str
    is_verified: bool
    created_at: datetime


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    otp_code: Optional[str] = None

    @field_validator("mobile_number", mode="before")
    @classmethod
    def clean_mob(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class VehicleDetailOut(BaseModel):
    id: str
    plate_number: str
    vehicle_type: str
    model: Optional[str] = None
    rto_code: Optional[str] = None
    registration_status: str = "Verified"
    pending_challans: int = 0
    total_challan_amount: float = 0.0


class VehicleOwnerOut(BaseModel):
    id: str
    plate_number: str
    vehicle_type: str
    model: Optional[str] = None
    rto_code: Optional[str] = None
    owner_name: str
    masked_mobile: str
    masked_email: Optional[str] = None

    class Config:
        from_attributes = True


class OwnerChallanOut(BaseModel):
    id: str
    vehicle_plate: str
    violation_name: str
    violation_code: Optional[str] = None
    fine_amount: float
    status: str
    violation_datetime: datetime
    location: Optional[str] = None
    payment_date: Optional[datetime] = None
    has_evidence: bool = False
    evidence_url: Optional[str] = None
    evidence_type: Optional[str] = None
    evidence_missing_reason: Optional[str] = None


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


class DetectedVehicle(BaseModel):
    vehicle_id: Optional[int] = None
    vehicle_type: str = "vehicle"
    confidence: float = 1.0
    bbox: Optional[List[float]] = None
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    plate_bbox: Optional[List[float]] = None
    violations_found: List[str] = []


class DetectionResult(BaseModel):
    violations_found: List[str]
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    boxes: List[DetectionBox] = []
    detected_vehicles: List[DetectedVehicle] = []
    annotated_file_path: Optional[str] = None
    inference_time_ms: Optional[float] = None
    ocr_time_ms: Optional[float] = None
    processing_time_ms: Optional[float] = None


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
    email_sent: Optional[bool] = None
    email_status: Optional[str] = None
    recipient_email: Optional[str] = None
    email_error: Optional[str] = None

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


# ---------- Officer Portal Schemas ----------
class OfficerLoginRequest(BaseModel):
    email: str
    password: str


class OfficerProfileOut(BaseModel):
    id: str
    name: str
    badge_number: str
    email: str
    station: Optional[str] = None
    jurisdiction: Optional[str] = None
    status: str = "ACTIVE"


class OfficerDashboardSummary(BaseModel):
    officer: OfficerProfileOut
    violations_today: int
    challans_today: int
    pending_challans: int
    paid_challans: int
    overdue_challans: int


class RepeatViolatorOut(BaseModel):
    vehicle_id: str
    vehicle_number: str
    vehicle_type: str
    model: Optional[str] = None
    registered_owner: str
    total_challans: int
    paid_challans: int
    pending_challans: int
    total_pending_amount: float
    enforcement_status: str  # "Normal" | "ACTION REQUIRED"
    action_required: bool    # True if pending_challans >= 3


class EnforcementActionCreate(BaseModel):
    vehicle_number: str
    action_type: str
    location: Optional[str] = None
    notes: Optional[str] = None
    related_challan_ids: Optional[List[str]] = None


class EnforcementActionOut(BaseModel):
    id: str
    officer_badge: str
    officer_name: str
    vehicle_number: str
    action_type: str
    location: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime


class AdminOfficerCreate(BaseModel):
    full_name: str
    email: str
    password: str
    badge_number: str
    station: Optional[str] = None
    jurisdiction: Optional[str] = None


class AdminOfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    station: Optional[str] = None
    jurisdiction: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class AdminChallanStatusUpdate(BaseModel):
    status: str  # pending, paid, disputed, cancelled
    notes: Optional[str] = None


class SystemSettingsBatchUpdate(BaseModel):
    settings: dict[str, str]


class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    target_resource: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminCreateVehicleRequest(BaseModel):
    vehicle_number: str = Field(..., min_length=4, max_length=20)
    owner_name: str = Field(..., min_length=1, max_length=100)
    owner_mobile: str = Field(..., pattern=r"^\d{10}$")
    owner_email: EmailStr
    vehicle_model: str = Field(..., min_length=1, max_length=100)
    vehicle_type: Optional[str] = None

    @field_validator("owner_mobile", mode="before")
    @classmethod
    def clean_owner_mobile(cls, v: Any) -> Any:
        return clean_mobile_str(v)


class AdminUpdateVehicleRequest(BaseModel):
    owner_name: Optional[str] = None
    owner_mobile: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    vehicle_model: Optional[str] = None
    vehicle_type: Optional[str] = None

    @field_validator("owner_mobile", mode="before")
    @classmethod
    def clean_owner_mobile(cls, v: Any) -> Any:
        return clean_mobile_str(v)



