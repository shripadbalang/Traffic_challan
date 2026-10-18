import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Numeric, Float, Text, Enum, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    owner = "owner"
    citizen = "citizen"
    officer = "officer"
    admin = "admin"


class DetectionSource(str, enum.Enum):
    ai = "ai"
    manual = "manual"


class ChallanStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    disputed = "disputed"
    cancelled = "cancelled"


class NotificationChannel(str, enum.Enum):
    email = "email"
    in_app = "in_app"
    sms = "sms"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    full_name = Column(String, nullable=False)
    mobile_number = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.citizen)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicles = relationship("Vehicle", back_populates="owner")
    officer_profile = relationship("Officer", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    plate_number = Column(String, unique=True, nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    vehicle_type = Column(String, nullable=False)  # e.g. "motorcycle", "car"
    model = Column(String, nullable=True)
    rto_code = Column(String, nullable=True)  # e.g. "MH12"
    registered_mobile = Column(String, nullable=True, index=True)
    registration_date = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="vehicles")
    challans = relationship("Challan", back_populates="vehicle")


class Officer(Base):
    __tablename__ = "officers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    badge_number = Column(String, unique=True, nullable=False)
    station = Column(String, nullable=True)
    jurisdiction = Column(String, nullable=True)  # e.g. "Pune City"

    user = relationship("User", back_populates="officer_profile")
    challans_issued = relationship("Challan", back_populates="officer")


class ViolationType(Base):
    __tablename__ = "violation_types"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    code = Column(String, unique=True, nullable=False)  # e.g. "NO_HELMET"
    name = Column(String, nullable=False)
    base_fine_amount = Column(Numeric(10, 2), nullable=False)
    legal_section = Column(String, nullable=True)

    challans = relationship("Challan", back_populates="violation_type")


class Challan(Base):
    __tablename__ = "challans"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    vehicle_id = Column(UUID(as_uuid=False), ForeignKey("vehicles.id"), nullable=False)
    violation_type_id = Column(UUID(as_uuid=False), ForeignKey("violation_types.id"), nullable=False)
    officer_id = Column(UUID(as_uuid=False), ForeignKey("officers.id"), nullable=True)  # null if AI-generated

    detection_source = Column(Enum(DetectionSource), nullable=False)
    fine_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(ChallanStatus), nullable=False, default=ChallanStatus.pending)
    ai_confidence_score = Column(Float, nullable=True)

    violation_datetime = Column(DateTime, nullable=False, default=datetime.utcnow)
    location = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="challans")
    violation_type = relationship("ViolationType", back_populates="challans")
    officer = relationship("Officer", back_populates="challans_issued")
    evidence = relationship("Evidence", back_populates="challan")
    payment = relationship("Payment", back_populates="challan", uselist=False)
    notifications = relationship("Notification", back_populates="challan")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    challan_id = Column(UUID(as_uuid=False), ForeignKey("challans.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # "image" | "video"
    ai_annotations_json = Column(Text, nullable=True)  # bbox coords, class, confidence

    challan = relationship("Challan", back_populates="evidence")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    challan_id = Column(UUID(as_uuid=False), ForeignKey("challans.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String, nullable=False, default="initiated")  # initiated/success/failed
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    receipt_qr_path = Column(String, nullable=True)
    receipt_pdf_path = Column(String, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    challan = relationship("Challan", back_populates="payment")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    challan_id = Column(UUID(as_uuid=False), ForeignKey("challans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    status = Column(String, default="sent")  # sent/failed
    message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    challan = relationship("Challan", back_populates="notifications")
    user = relationship("User", back_populates="notifications")


class OtpCode(Base):
    """Simulated OTP store — real SMS gateway not used for demo purposes."""
    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    mobile_number = Column(String, nullable=True, index=True)
    email = Column(String, nullable=True, index=True)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class EnforcementAction(Base):
    __tablename__ = "enforcement_actions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    officer_id = Column(UUID(as_uuid=False), ForeignKey("officers.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=False), ForeignKey("vehicles.id"), nullable=False)
    vehicle_number = Column(String, nullable=False, index=True)
    action_type = Column(String, nullable=False)  # "Warning Notice", "Physical Notice", "Tow Request", "Court Summons", "Vehicle Immobilization"
    location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    related_challan_ids = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="RECORDED")
    created_at = Column(DateTime, default=datetime.utcnow)

    officer = relationship("Officer")
    vehicle = relationship("Vehicle")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    user_email = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    action = Column(String, nullable=False, index=True)
    target_resource = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    status = Column(String, nullable=False, default="SUCCESS")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)


