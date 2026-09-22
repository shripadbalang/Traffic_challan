import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy.orm import Session

from app.config import settings
from app import models


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[EMAIL - not configured, logging only] To: {to_email} | {subject}\n{body}")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] {exc}")
        return False


def send_simulated_sms(mobile_number: str, message: str) -> None:
    """No real SMS gateway is used for this demo project. Instead the message
    is logged and stored as a Notification record with channel=sms, visible in
    an 'SMS Outbox' view in the admin dashboard — clearly labeled as simulated."""
    print(f"[SIMULATED SMS] To: {mobile_number} | {message}")


def notify_challan_created(db: Session, challan: models.Challan, user: models.User) -> None:
    plate = challan.vehicle.plate_number
    subject = f"E-Challan Issued — {plate}"
    body = (
        f"Dear {user.full_name},\n\n"
        f"A traffic violation ({challan.violation_type.name}) has been recorded against "
        f"vehicle {plate} on {challan.violation_datetime.strftime('%d %b %Y, %I:%M %p')}.\n"
        f"Fine amount: Rs. {challan.fine_amount}\n"
        f"Challan ID: {challan.id}\n\n"
        f"Please log in to the citizen dashboard to view evidence and pay.\n"
    )

    # Email
    email_sent = send_email(user.email, subject, body) if user.email else False
    db.add(models.Notification(
        challan_id=challan.id, user_id=user.id, channel=models.NotificationChannel.email,
        status="sent" if email_sent else "failed", message=body,
    ))

    # In-app
    db.add(models.Notification(
        challan_id=challan.id, user_id=user.id, channel=models.NotificationChannel.in_app,
        status="sent", message=f"New challan issued for {plate} — Rs. {challan.fine_amount}",
    ))

    # Simulated SMS
    sms_text = f"Challan issued for {plate}, fine Rs.{challan.fine_amount}. Challan ID: {challan.id}"
    send_simulated_sms(user.mobile_number, sms_text)
    db.add(models.Notification(
        challan_id=challan.id, user_id=user.id, channel=models.NotificationChannel.sms,
        status="sent", message=sms_text,
    ))

    db.commit()
