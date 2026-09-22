from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import hash_password, verify_password, create_access_token, generate_otp
from app.services.notification_service import send_email, send_simulated_sms

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_VALIDITY_MINUTES = 5


@router.post("/citizen/signup", response_model=dict)
def citizen_signup(payload: schemas.CitizenSignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this mobile number already exists")

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == payload.plate_number.upper()).first()
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found in RTO records. Please check the plate number.",
        )

    user = models.User(
        full_name=payload.full_name,
        mobile_number=payload.mobile_number,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=models.UserRole.citizen,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # get user.id before commit

    vehicle.owner_id = user.id
    db.commit()

    return {"message": "Signup successful. Please verify your mobile number with OTP.", "user_id": user.id}


@router.post("/otp/request")
def request_otp(payload: schemas.OtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this mobile number")

    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=payload.mobile_number,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
    )
    db.add(otp)
    db.commit()

    # Simulated delivery — no real SMS gateway. Also emailed if available for convenience.
    send_simulated_sms(payload.mobile_number, f"Your verification code is {code}. Valid for {OTP_VALIDITY_MINUTES} minutes.")
    if user.email:
        send_email(user.email, "Your OTP Code", f"Your verification code is {code}.")

    response = {"message": "OTP sent (simulated)."}
    if True:  # ENV == development-style convenience flag; remove for a "stricter" demo
        response["debug_otp"] = code  # shown on-screen so you don't need real SMS to demo
    return response


@router.post("/otp/verify", response_model=schemas.TokenResponse)
def verify_otp(payload: schemas.OtpVerifyRequest, db: Session = Depends(get_db)):
    otp = (
        db.query(models.OtpCode)
        .filter(
            models.OtpCode.mobile_number == payload.mobile_number,
            models.OtpCode.code == payload.code,
            models.OtpCode.is_used == False,  # noqa: E712
        )
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )
    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    otp.is_used = True
    user = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    user.is_verified = True
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return schemas.TokenResponse(access_token=token, role=user.role.value)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Used by citizens (email/password, post-OTP-verification accounts),
    officers, and admins — identifier can be email or mobile number."""
    user = (
        db.query(models.User)
        .filter(
            (models.User.email == payload.identifier) | (models.User.mobile_number == payload.identifier)
        )
        .first()
    )
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.role == models.UserRole.citizen and not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your mobile number via OTP first")

    token = create_access_token(subject=user.id, role=user.role.value)
    return schemas.TokenResponse(access_token=token, role=user.role.value)
