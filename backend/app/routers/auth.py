import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import hash_password, verify_password, create_access_token, generate_otp
from app.core.limiter import limiter
from app.services.notification_service import send_email, send_simulated_sms

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_VALIDITY_MINUTES = 5


@router.post("/citizen/signup", response_model=dict)
@limiter.limit("5/minute")
def citizen_signup(request: Request, payload: schemas.CitizenSignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this mobile number already exists")

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == payload.plate_number.upper()).first()
    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found in RTO records. Please check the plate number.",
        )

    if vehicle.owner_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This vehicle is already registered to an existing citizen account. Please contact support or submit an ownership claim.",
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
@limiter.limit("5/minute")
def request_otp(request: Request, payload: schemas.OtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if not user:
        # Prevent phone number enumeration by returning generic response
        return {"message": "If an account exists with this mobile number, an OTP has been sent."}

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
    if settings.ENV in ("development", "test"):
        response["debug_otp"] = code  # Only exposed during local dev/testing; NEVER in production
    return response


@router.post("/otp/verify", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
def verify_otp(request: Request, payload: schemas.OtpVerifyRequest, db: Session = Depends(get_db)):
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
@limiter.limit("5/minute")
def login(request: Request, payload: schemas.LoginRequest, db: Session = Depends(get_db)):
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


@router.post("/officer/login")
@limiter.limit("30/minute")
def officer_login(request: Request, payload: schemas.OfficerLoginRequest, db: Session = Depends(get_db)):
    """
    Dedicated Traffic Officer Login endpoint.
    Only officers assigned/created by an Admin can log in.
    Rejects citizens/owners, non-existent accounts, and disabled accounts.
    """
    clean_email = payload.email.strip().lower()

    user = (
        db.query(models.User)
        .filter(models.User.email == clean_email)
        .first()
    )

    # If the account does not exist or user role is not officer
    if not user or user.role != models.UserRole.officer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Officer account not found. Please contact the administrator.",
        )

    # If account is disabled by Admin
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer account is disabled. Please contact the administrator.",
        )

    # Verify password hash
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid official email or password.",
        )

    officer_profile = user.officer_profile

    token = create_access_token(subject=str(user.id), role="officer", email=user.email)

    return {
        "success": True,
        "access_token": token,
        "role": "officer",
        "user": {
            "id": str(user.id),
            "fullName": user.full_name,
            "email": user.email,
            "role": "officer",
            "isVerified": user.is_verified,
        },
        "officer": {
            "id": str(officer_profile.id) if officer_profile else str(user.id),
            "badge_number": officer_profile.badge_number if officer_profile else "N/A",
            "badgeNumber": officer_profile.badge_number if officer_profile else "N/A",
            "station": officer_profile.station if officer_profile else "Maharashtra Traffic Headquarters",
            "jurisdiction": officer_profile.jurisdiction if officer_profile else "General Enforcement Zone",
            "status": "ACTIVE" if user.is_verified else "DISABLED",
        },
    }


@router.post("/admin/login", response_model=schemas.TokenResponse)
@limiter.limit("20/minute")
def admin_login(request: Request, payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """
    Dedicated Admin Portal Login endpoint.
    Strictly restricted to users with the ADMIN role.
    Verifies credentials, checks is_verified, logs audit event, and returns JWT.
    """
    clean_identifier = payload.identifier.strip().lower()
    client_ip = request.client.host if request.client else "unknown"

    user = (
        db.query(models.User)
        .filter(
            (models.User.email == clean_identifier) | (models.User.mobile_number == clean_identifier)
        )
        .first()
    )

    # If user doesn't exist or is not an admin
    if not user or user.role != models.UserRole.admin:
        from app.core.audit import log_audit_event
        log_audit_event(
            db=db,
            action="admin_login_failed",
            target_resource="auth",
            details=f"Unauthorized admin login attempt for '{clean_identifier}'. Role mismatch or account not found.",
            ip_address=client_ip,
            status="FAILED",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Insufficient administrative privileges. This portal is restricted to Department Administrators.",
        )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        from app.core.audit import log_audit_event
        log_audit_event(
            db=db,
            action="admin_login_failed",
            target_resource="auth",
            user=user,
            target_id=str(user.id),
            details=f"Invalid password attempt for admin account '{clean_identifier}'.",
            ip_address=client_ip,
            status="FAILED",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative email or password.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator account is currently inactive. Please contact the system owner.",
        )

    token = create_access_token(
        subject=str(user.id),
        role="admin",
        email=user.email,
    )

    from app.core.audit import log_audit_event
    log_audit_event(
        db=db,
        action="admin_login",
        target_resource="auth",
        user=user,
        target_id=str(user.id),
        details=f"Admin {user.full_name} logged in successfully.",
        ip_address=client_ip,
        status="SUCCESS",
    )

    return schemas.TokenResponse(
        access_token=token,
        role="admin",
        user={
            "id": str(user.id),
            "fullName": user.full_name,
            "email": user.email,
            "role": "admin",
            "isVerified": user.is_verified,
        },
    )


@router.post("/owner/request-otp")
@limiter.limit("5/minute")
def request_owner_otp(request: Request, payload: schemas.OwnerOtpRequest, db: Session = Depends(get_db)):
    plate_clean = re.sub(r"[^a-zA-Z0-9]", "", payload.vehicle_number).upper()
    mobile_clean = re.sub(r"\D", "", payload.mobile_number)
    if mobile_clean.startswith("91") and len(mobile_clean) > 10:
        mobile_clean = mobile_clean[2:]
    elif mobile_clean.startswith("0") and len(mobile_clean) > 10:
        mobile_clean = re.sub(r"^0+", "", mobile_clean)

    vehicle = (
        db.query(models.Vehicle)
        .filter(models.Vehicle.plate_number == plate_clean)
        .first()
    )
    if not vehicle or not vehicle.owner or vehicle.owner.mobile_number != mobile_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle or mobile number is not registered. Please check your details or contact the concerned authority.",
        )

    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=mobile_clean,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
    )
    db.add(otp)
    db.commit()

    send_simulated_sms(
        mobile_clean,
        f"Your MahaTraffic portal login code is {code}. Valid for {OTP_VALIDITY_MINUTES} minutes."
    )
    if vehicle.owner.email:
        send_email(vehicle.owner.email, "MahaTraffic Login OTP", f"Your login verification code is {code}.")

    masked_mobile = f"******{mobile_clean[-4:]}" if len(mobile_clean) >= 4 else "******"
    return {
        "message": "OTP sent successfully to registered mobile number.",
        "masked_mobile": masked_mobile,
        "owner_name": vehicle.owner.full_name,
        "vehicle_number": vehicle.plate_number,
        "debug_otp": code if settings.ENV in ("development", "test") else None,
    }


@router.post("/owner/verify-otp", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
def verify_owner_otp(request: Request, payload: schemas.OwnerOtpVerifyRequest, db: Session = Depends(get_db)):
    plate_clean = re.sub(r"[^a-zA-Z0-9]", "", payload.vehicle_number).upper()
    mobile_clean = re.sub(r"\D", "", payload.mobile_number)
    if mobile_clean.startswith("91") and len(mobile_clean) > 10:
        mobile_clean = mobile_clean[2:]
    elif mobile_clean.startswith("0") and len(mobile_clean) > 10:
        mobile_clean = re.sub(r"^0+", "", mobile_clean)

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == plate_clean).first()
    if not vehicle or not vehicle.owner or vehicle.owner.mobile_number != mobile_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle or mobile number is not registered. Please check your details or contact the concerned authority.",
        )

    otp = (
        db.query(models.OtpCode)
        .filter(
            models.OtpCode.mobile_number == mobile_clean,
            models.OtpCode.code == payload.code.strip(),
            models.OtpCode.is_used == False,  # noqa: E712
        )
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )
    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new code.",
        )

    otp.is_used = True
    user = vehicle.owner
    user.is_verified = True
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        role=user.role.value,
        user={
            "id": user.id,
            "full_name": user.full_name,
            "mobile_number": user.mobile_number,
            "email": user.email,
        },
    )


# ------------------ New Owner User Account System ------------------

@router.post("/owner/register-initiate")
@limiter.limit("5/minute")
def owner_register_initiate(request: Request, payload: schemas.OwnerSignupInitiateRequest, db: Session = Depends(get_db)):
    clean_mob = re.sub(r"\D", "", payload.mobile_number)
    if clean_mob.startswith("91") and len(clean_mob) > 10:
        clean_mob = clean_mob[2:]
    elif clean_mob.startswith("0") and len(clean_mob) > 10:
        clean_mob = re.sub(r"^0+", "", clean_mob)
    clean_email = payload.email.strip().lower()

    # Check if verified account already exists with this email or mobile
    existing_user = db.query(models.User).filter(
        ((models.User.email == clean_email) | (models.User.mobile_number == clean_mob)),
        models.User.is_verified == True  # noqa: E712
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email or mobile number already exists. Please log in.",
        )

    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=clean_mob,
        email=clean_email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
        is_used=False,
        attempts=0,
    )
    db.add(otp)
    db.commit()

    # Dispatch via simulated SMS & email
    first_name = payload.full_name.strip().split()[0] if payload.full_name else "User"
    email_subject = "Verify Your Traffic Challan Account"
    email_body = (
        f"Subject: {email_subject}\n\n"
        f"Hello {first_name},\n\n"
        f"Your OTP for verifying your Traffic Challan account is:\n\n"
        f"{code}\n\n"
        f"This OTP will expire shortly.\n\n"
        f"If you did not request this OTP, please ignore this email.\n\n"
        f"Regards,\n"
        f"Traffic Challan Management System"
    )
    send_email(clean_email, email_subject, email_body)
    send_simulated_sms(clean_mob, f"Your Traffic Portal registration OTP is {code}. Valid for {OTP_VALIDITY_MINUTES} minutes.")

    masked_mobile = f"******{clean_mob[-4:]}" if len(clean_mob) >= 4 else "******"
    return {
        "message": f"Verification OTP sent to your registered email {clean_email} and mobile {masked_mobile}.",
        "mobile_number": clean_mob,
        "email": clean_email,
    }


@router.post("/owner/register-verify", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
def owner_register_verify(request: Request, payload: schemas.OwnerSignupVerifyRequest, db: Session = Depends(get_db)):
    clean_mob = re.sub(r"\D", "", payload.mobile_number)
    if clean_mob.startswith("91") and len(clean_mob) > 10:
        clean_mob = clean_mob[2:]
    elif clean_mob.startswith("0") and len(clean_mob) > 10:
        clean_mob = re.sub(r"^0+", "", clean_mob)
    clean_email = payload.email.strip().lower()

    otp = (
        db.query(models.OtpCode)
        .filter(
            (models.OtpCode.mobile_number == clean_mob) | (models.OtpCode.email == clean_email),
            models.OtpCode.is_used == False,  # noqa: E712
        )
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )

    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new code.",
        )

    if otp.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect OTP attempts. Please request a new OTP.",
        )

    if otp.code != payload.code.strip():
        otp.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP. Please enter the correct 6-digit code.",
        )

    otp.is_used = True

    # Look for existing user or create new
    user = db.query(models.User).filter(
        (models.User.email == clean_email) | (models.User.mobile_number == clean_mob)
    ).first()

    if not user:
        user = models.User(
            full_name=payload.full_name.strip(),
            email=clean_email,
            mobile_number=clean_mob,
            role=models.UserRole.owner,
            is_verified=True,
        )
        db.add(user)
    else:
        user.full_name = payload.full_name.strip()
        user.email = clean_email
        user.mobile_number = clean_mob
        user.is_verified = True
        user.role = models.UserRole.owner

    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role="owner")
    return schemas.TokenResponse(
        access_token=token,
        role="owner",
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "mobile_number": user.mobile_number,
            "email": user.email,
            "role": "owner",
        },
    )


@router.post("/owner/login-initiate")
@limiter.limit("5/minute")
def owner_login_initiate(request: Request, payload: schemas.OwnerLoginInitiateRequest, db: Session = Depends(get_db)):
    raw_id = payload.identifier.strip()
    is_email = "@" in raw_id
    if is_email:
        clean_id = raw_id.lower()
        user = db.query(models.User).filter(
            (models.User.email == clean_id) |
            (models.User.email == clean_id.replace("shripad", "shripat")) |
            (models.User.email == clean_id.replace("shripat", "shripad"))
        ).first()
    else:
        clean_mob = re.sub(r"\D", "", raw_id)
        if clean_mob.startswith("91") and len(clean_mob) > 10:
            clean_mob = clean_mob[2:]
        elif clean_mob.startswith("0") and len(clean_mob) > 10:
            clean_mob = re.sub(r"^0+", "", clean_mob)
        clean_id = clean_mob
        user = db.query(models.User).filter(models.User.mobile_number == clean_mob).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email or mobile number. Please create an account.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified. Please complete account registration first.",
        )

    target_email = clean_id if is_email else user.email
    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=user.mobile_number,
        email=target_email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
        is_used=False,
        attempts=0,
    )
    db.add(otp)
    db.commit()

    if user.mobile_number:
        send_simulated_sms(
            user.mobile_number,
            f"Your Traffic Portal login code is {code}. Valid for {OTP_VALIDITY_MINUTES} minutes."
        )
    if target_email:
        first_name = user.full_name.strip().split()[0] if user.full_name else "User"
        email_subject = "Verify Your Traffic Challan Account"
        email_body = (
            f"Subject: {email_subject}\n\n"
            f"Hello {first_name},\n\n"
            f"Your OTP for verifying your Traffic Challan account is:\n\n"
            f"{code}\n\n"
            f"This OTP will expire shortly.\n\n"
            f"If you did not request this OTP, please ignore this email.\n\n"
            f"Regards,\n"
            f"Traffic Challan Management System"
        )
        send_email(target_email, email_subject, email_body)

    masked_contact = (
        target_email
        if is_email
        else (f"******{user.mobile_number[-4:]}" if user.mobile_number and len(user.mobile_number) >= 4 else "your registered contact")
    )

    return {
        "message": f"Login OTP sent to {masked_contact}.",
        "masked_contact": masked_contact,
        "identifier": clean_id,
    }


@router.post("/owner/login-verify", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
def owner_login_verify(request: Request, payload: schemas.OwnerLoginVerifyRequest, db: Session = Depends(get_db)):
    raw_id = payload.identifier.strip()
    is_email = "@" in raw_id
    if is_email:
        clean_id = raw_id.lower()
        user = db.query(models.User).filter(
            (models.User.email == clean_id) |
            (models.User.email == clean_id.replace("shripad", "shripat")) |
            (models.User.email == clean_id.replace("shripat", "shripad"))
        ).first()
    else:
        clean_mob = re.sub(r"\D", "", raw_id)
        if clean_mob.startswith("91") and len(clean_mob) > 10:
            clean_mob = clean_mob[2:]
        elif clean_mob.startswith("0") and len(clean_mob) > 10:
            clean_mob = re.sub(r"^0+", "", clean_mob)
        clean_id = clean_mob
        user = db.query(models.User).filter(models.User.mobile_number == clean_mob).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    target_email = clean_id if is_email else user.email
    otp = (
        db.query(models.OtpCode)
        .filter(
            ((models.OtpCode.mobile_number == user.mobile_number) | (models.OtpCode.email == target_email) | (models.OtpCode.email == user.email)),
            models.OtpCode.is_used == False,  # noqa: E712
        )
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )

    if not otp or otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new code.",
        )

    if otp.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect OTP attempts. Please request a new OTP.",
        )

    if otp.code != payload.code.strip():
        otp.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP. Please enter the correct 6-digit code.",
        )

    otp.is_used = True
    user.is_verified = True
    db.commit()

    user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(subject=str(user.id), role=user_role_str)
    return schemas.TokenResponse(
        access_token=token,
        role=user_role_str,
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "mobile_number": user.mobile_number,
            "email": target_email or user.email,
            "role": user_role_str,
        },
    )


@router.post("/owner/resend-otp")
@limiter.limit("5/minute")
def owner_resend_otp(request: Request, payload: schemas.OwnerResendOtpRequest, db: Session = Depends(get_db)):
    raw_id = payload.identifier.strip()
    is_email = "@" in raw_id
    clean_mob = None
    clean_email = None

    if is_email:
        clean_email = raw_id.lower()
        user = db.query(models.User).filter(
            (models.User.email == clean_email) |
            (models.User.email == clean_email.replace("shripad", "shripat")) |
            (models.User.email == clean_email.replace("shripat", "shripad"))
        ).first()
        if user and user.mobile_number:
            clean_mob = user.mobile_number
    else:
        clean_mob = re.sub(r"\D", "", raw_id)
        if len(clean_mob) == 12 and clean_mob.startswith("91"):
            clean_mob = clean_mob[2:]
        user = db.query(models.User).filter(models.User.mobile_number == clean_mob).first()
        if user and user.email:
            clean_email = user.email

    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=clean_mob,
        email=clean_email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
        is_used=False,
        attempts=0,
    )
    db.add(otp)
    db.commit()

    if clean_mob:
        send_simulated_sms(clean_mob, f"Your new Traffic Portal verification code is {code}. Valid for {OTP_VALIDITY_MINUTES} minutes.")
    if clean_email:
        email_subject = "Verify Your Traffic Challan Account"
        email_body = (
            f"Subject: {email_subject}\n\n"
            f"Hello User,\n\n"
            f"Your OTP for verifying your Traffic Challan account is:\n\n"
            f"{code}\n\n"
            f"This OTP will expire shortly.\n\n"
            f"If you did not request this OTP, please ignore this email.\n\n"
            f"Regards,\n"
            f"Traffic Challan Management System"
        )
        send_email(clean_email, email_subject, email_body)

    return {
        "message": "A new OTP code has been dispatched to your registered contact.",
    }

