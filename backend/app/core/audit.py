from typing import Optional
from sqlalchemy.orm import Session
from app import models


def log_audit_event(
    db: Session,
    action: str,
    target_resource: Optional[str] = None,
    user: Optional[models.User] = None,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    status: str = "SUCCESS",
) -> Optional[models.AuditLog]:
    """
    Safely records an administrative or security audit action into the database.
    Does not crash the request if database write encounters any issue.
    """
    try:
        user_role_val = None
        if user:
            user_role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

        audit_entry = models.AuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            user_role=user_role_val,
            action=action,
            target_resource=target_resource,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
            status=status,
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        db.rollback()
        print(f"[Audit Log Warning] Could not record audit log: {e}")
        return None
