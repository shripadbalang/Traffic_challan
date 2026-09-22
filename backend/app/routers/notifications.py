from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/my")
def my_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    notifs = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.channel == models.NotificationChannel.in_app)
        .order_by(models.Notification.sent_at.desc())
        .all()
    )
    return [{"id": n.id, "message": n.message, "sent_at": n.sent_at, "challan_id": n.challan_id} for n in notifs]


@router.get("/admin/sms-outbox")
def sms_outbox(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_role("admin")),
):
    """Admin-only view of simulated SMS messages, since no real SMS gateway is used."""
    notifs = (
        db.query(models.Notification)
        .filter(models.Notification.channel == models.NotificationChannel.sms)
        .order_by(models.Notification.sent_at.desc())
        .limit(200)
        .all()
    )
    return [
        {"id": n.id, "to_user": n.user.mobile_number, "message": n.message, "sent_at": n.sent_at}
        for n in notifs
    ]
