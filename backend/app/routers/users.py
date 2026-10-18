import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import get_current_user, generate_otp
from app.core.limiter import limiter
from app.services.notification_service import send_email, send_simulated_sms

router = APIRouter(prefix="/users", tags=["users"])

OTP_VALIDITY_MINUTES = 5


@router.get("/profile", response_model=schemas.UserProfileOut)
def get_user_profile(user: models.User = Depends(get_current_user)):
    """Return profile details for the currently authenticated user."""
    return schemas.UserProfileOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        mobile_number=user.mobile_number,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_verified=user.is_verified,
        created_at=user.created_at,
    )


@router.post("/profile/request-contact-otp")
@limiter.limit("5/minute")
def request_contact_change_otp(
    request: Request,
    payload: schemas.OwnerResendOtpRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Generates an OTP to verify a new email or mobile number during profile update."""
    target = payload.identifier.strip()
    is_email = "@" in target

    # Check if target is already used by another verified user
    if is_email:
        existing = db.query(models.User).filter(models.User.email == target, models.User.id != user.id).first()
        if existing and existing.is_verified:
            raise HTTPException(status_code=400, detail="This email address is already registered to another account.")
    else:
        clean_mob = re.sub(r"\D", "", target)
        if len(clean_mob) == 12 and clean_mob.startswith("91"):
            clean_mob = clean_mob[2:]
        if len(clean_mob) != 10:
            raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number.")
        existing = db.query(models.User).filter(models.User.mobile_number == clean_mob, models.User.id != user.id).first()
        if existing and existing.is_verified:
            raise HTTPException(status_code=400, detail="This mobile number is already registered to another account.")
        target = clean_mob

    code = generate_otp()
    otp = models.OtpCode(
        mobile_number=target if not is_email else None,
        email=target if is_email else None,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
        is_used=False,
        attempts=0,
    )
    db.add(otp)
    db.commit()

    if is_email:
        send_email(target, "Verify Contact Change", f"Your OTP to update your contact detail is {code}.")
    else:
        send_simulated_sms(target, f"Your verification code to update your mobile number is {code}.")

    return {
        "message": "Verification OTP sent successfully to the new contact method.",
    }


@router.put("/profile", response_model=schemas.UserProfileOut)
def update_user_profile(
    payload: schemas.UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Update profile details.
    Changing email or mobile number requires providing the verified OTP code.
    Role cannot be modified by user.
    """
    if payload.full_name and payload.full_name.strip():
        user.full_name = payload.full_name.strip()

    # Check mobile number change
    if payload.mobile_number:
        clean_mob = re.sub(r"\D", "", payload.mobile_number)
        if len(clean_mob) == 12 and clean_mob.startswith("91"):
            clean_mob = clean_mob[2:]
        if clean_mob != user.mobile_number:
            if not payload.otp_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="OTP verification code is required to change mobile number.",
                )
            # Verify OTP
            otp = (
                db.query(models.OtpCode)
                .filter(
                    models.OtpCode.mobile_number == clean_mob,
                    models.OtpCode.code == payload.otp_code.strip(),
                    models.OtpCode.is_used == False,  # noqa: E712
                )
                .order_by(models.OtpCode.created_at.desc())
                .first()
            )
            if not otp or otp.expires_at < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Invalid or expired OTP for mobile number change.")
            otp.is_used = True
            user.mobile_number = clean_mob

    # Check email change
    if payload.email and payload.email.strip().lower() != (user.email or "").lower():
        new_email = payload.email.strip().lower()
        if not payload.otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP verification code is required to change email address.",
            )
        otp = (
            db.query(models.OtpCode)
            .filter(
                models.OtpCode.email == new_email,
                models.OtpCode.code == payload.otp_code.strip(),
                models.OtpCode.is_used == False,  # noqa: E712
            )
            .order_by(models.OtpCode.created_at.desc())
            .first()
        )
        if not otp or otp.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired OTP for email change.")
        otp.is_used = True
        user.email = new_email

    db.commit()
    db.refresh(user)

    return schemas.UserProfileOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        mobile_number=user.mobile_number,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_verified=user.is_verified,
        created_at=user.created_at,
    )


@router.post("/sync-owner-profile")
def sync_owner_profile(
    payload: schemas.OwnerProfileSyncRequest,
    db: Session = Depends(get_db),
):
    """
    Syncs the authenticated Supabase user identity into public.users.
    Links auth.users.id as the canonical user ID, ensuring owner data integrity.
    Returns the user profile and an access token for backend operations.
    """
    user_id = payload.user_id.strip()
    clean_email = payload.email.strip().lower()

    clean_mob = None
    if payload.mobile_number:
        clean_mob = re.sub(r"\D", "", payload.mobile_number)
        if len(clean_mob) == 12 and clean_mob.startswith("91"):
            clean_mob = clean_mob[2:]
        if len(clean_mob) != 10:
            clean_mob = None

    # 1. Lookup by user_id
    user = db.query(models.User).filter(models.User.id == user_id).first()

    # 2. If not found by ID, lookup by email or mobile
    if not user:
        user = db.query(models.User).filter(models.User.email == clean_email).first()
    if not user and clean_mob:
        user = db.query(models.User).filter(models.User.mobile_number == clean_mob).first()

    # Handle mobile constraint if clean_mob is taken by another record
    if clean_mob:
        conflict_mob = db.query(models.User).filter(
            models.User.mobile_number == clean_mob,
            models.User.id != (user.id if user else user_id),
        ).first()
        if conflict_mob:
            if not conflict_mob.vehicles:
                conflict_mob.mobile_number = None
                db.commit()
            else:
                clean_mob = None

    if user:
        if payload.full_name and payload.full_name.strip():
            user.full_name = payload.full_name.strip()
        if clean_mob and not user.mobile_number:
            user.mobile_number = clean_mob
        user.is_verified = True
        db.commit()
        db.refresh(user)
    else:
        # Create new profile linked to user_id
        user = models.User(
            id=user_id,
            full_name=payload.full_name.strip() if payload.full_name else clean_email.split("@")[0].capitalize(),
            email=clean_email,
            mobile_number=clean_mob,
            role=models.UserRole.owner,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    from app.core.security import create_access_token
    token = create_access_token(subject=str(user.id), role="owner", email=user.email)

    return {
        "success": True,
        "access_token": token,
        "user": {
            "id": str(user.id),
            "fullName": user.full_name,
            "email": user.email,
            "mobileNumber": user.mobile_number,
            "role": "owner",
            "isVerified": user.is_verified,
        },
    }
