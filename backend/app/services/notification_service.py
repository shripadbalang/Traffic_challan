import smtplib
import socket
import re
import email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app import models


class NotificationResult(dict):
    """
    Structured outcome of an email dispatch.
    Acts like a dictionary (keys: success, status, recipient, recipient_email, message, error)
    while evaluating to True only when status == 'sent' for backward compatibility.
    """
    def __init__(self, data: dict):
        super().__init__(data)

    @property
    def success(self) -> bool:
        return bool(self.get("success", self.get("status") == "sent"))

    @property
    def status(self) -> str:
        return self.get("status", "failed")

    @property
    def recipient(self) -> Optional[str]:
        return self.get("recipient") or self.get("recipient_email")

    @property
    def recipient_email(self) -> Optional[str]:
        return self.get("recipient_email") or self.get("recipient")

    @property
    def message(self) -> str:
        return self.get("message", "")

    @property
    def error(self) -> Optional[str]:
        return self.get("error")

    def __bool__(self) -> bool:
        return self.status == "sent"


def send_email_detailed(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Sends an email using configured SMTP server (Gmail or custom).
    Returns (success: bool, error_message: Optional[str]).
    Strictly safeguards passwords, secrets, and tokens from ever being logged.
    """
    to_email = (to_email or "").strip()
    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not to_email or not re.match(email_regex, to_email):
        err = f"Invalid recipient email address: '{to_email}'"
        print(f"[EMAIL ERROR] Invalid recipient: '{to_email}'")
        return False, err

    smtp_host = (settings.SMTP_HOST or "smtp.gmail.com").strip()
    smtp_port = int(settings.SMTP_PORT or 587)
    smtp_user = (settings.SMTP_USER or "").strip()
    # Strip spaces from password (common when copying Google 16-character App Passwords "xxxx xxxx xxxx xxxx")
    smtp_password = (settings.SMTP_PASSWORD or "").replace(" ", "").strip()
    from_email = (getattr(settings, "SMTP_FROM", "") or smtp_user).strip()
    from_name = (settings.SMTP_FROM_NAME or "Maharashtra Traffic E-Challan").strip()

    if not smtp_user or not smtp_password:
        err = "SMTP credentials not configured (SMTP_USER / SMTP_PASSWORD in backend/.env)"
        print(f"[EMAIL ERROR] {err}")
        return False, err

    if not from_email:
        from_email = smtp_user

    print("[EMAIL] Preparing challan notification")
    print(f"[EMAIL] SMTP host: {smtp_host}")
    print(f"[EMAIL] SMTP port: {smtp_port}")
    print(f"[EMAIL] SMTP user: {smtp_user}")

    server = None
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["Message-ID"] = email.utils.make_msgid(domain=smtp_host if "." in smtp_host else "traffic.gov.in")

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        print(f"[EMAIL] Connecting...")
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
            server.ehlo()
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
            server.ehlo()
            print("[EMAIL] STARTTLS...")
            server.starttls()
            server.ehlo()

        print("[EMAIL] Authenticating...")
        server.login(smtp_user, smtp_password)
        print("[EMAIL] Sending...")
        server.sendmail(from_email, [to_email], msg.as_string())

        print(f"[EMAIL] Successfully sent to {to_email}")
        return True, None

    except smtplib.SMTPAuthenticationError as auth_err:
        err = "SMTP authentication failed: Invalid username or App Password."
        print(f"[EMAIL ERROR] SMTP authentication failed (code: {auth_err.smtp_code})")
        return False, err
    except smtplib.SMTPConnectError as conn_err:
        err = f"SMTP connection failed: Unable to connect to {smtp_host}:{smtp_port}."
        print(f"[EMAIL ERROR] SMTP connection failed: {conn_err}")
        return False, err
    except smtplib.SMTPServerDisconnected as disc_err:
        err = f"SMTP server unexpectedly disconnected: {disc_err}"
        print(f"[EMAIL ERROR] SMTP server unexpectedly disconnected: {disc_err}")
        return False, err
    except smtplib.SMTPRecipientsRefused as rec_err:
        err = f"SMTP recipient refused by mail server: {to_email}"
        print(f"[EMAIL ERROR] Invalid recipient: {to_email}")
        return False, err
    except (socket.timeout, TimeoutError) as timeout_err:
        err = f"SMTP connection timed out ({smtp_host}:{smtp_port})."
        print(f"[EMAIL ERROR] SMTP connection timed out: {timeout_err}")
        return False, err
    except smtplib.SMTPException as smtp_exc:
        err = f"SMTP protocol error: {type(smtp_exc).__name__}"
        print(f"[EMAIL ERROR] SMTP protocol failure: {type(smtp_exc).__name__}")
        return False, err
    except Exception as exc:
        err = f"Email delivery error: {type(exc).__name__}"
        print(f"[EMAIL ERROR] Unexpected email error: {type(exc).__name__}")
        return False, err
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                try:
                    server.close()
                except Exception:
                    pass


def send_email(to_email: str, subject: str, body: str, html_body: Optional[str] = None) -> bool:
    """
    Backwards-compatible wrapper returning boolean.
    """
    success, _ = send_email_detailed(to_email, subject, body, html_body)
    return success


def send_simulated_sms(mobile_number: str, message: str) -> None:
    """
    Dispatches SMS via Fast2SMS (India) or Twilio if configured, or logs a safe status notice.
    Never logs OTP codes or sensitive credentials.
    """
    import re
    clean_mob = re.sub(r"\D", "", mobile_number or "")
    if len(clean_mob) == 12 and clean_mob.startswith("91"):
        clean_mob = clean_mob[2:]

    if not clean_mob:
        return

    # 1. Fast2SMS Integration (India)
    if settings.FAST2SMS_API_KEY:
        try:
            import urllib.request
            import urllib.parse
            import json

            data = urllib.parse.urlencode({
                "authorization": settings.FAST2SMS_API_KEY,
                "message": message,
                "language": "english",
                "route": "q",
                "numbers": clean_mob,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://www.fast2sms.com/dev/bulkV2",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                resp = json.loads(response.read().decode())
                print(f"[FAST2SMS SENT] To: {clean_mob} | Status: {resp.get('return', True)}")
                return
        except Exception as exc:
            print(f"[FAST2SMS ERROR] Failed sending to {clean_mob}: {exc}")

    # 2. Twilio Integration (Global)
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
        try:
            import urllib.request
            import urllib.parse
            import base64

            auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
            b64_auth = base64.b64encode(auth_str.encode()).decode()
            target_phone = f"+91{clean_mob}" if not clean_mob.startswith("+") else clean_mob

            data = urllib.parse.urlencode({
                "To": target_phone,
                "From": settings.TWILIO_FROM_NUMBER,
                "Body": message,
            }).encode("utf-8")
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            req = urllib.request.Request(url, data=data, headers={"Authorization": f"Basic {b64_auth}"})
            with urllib.request.urlopen(req, timeout=5) as response:
                print(f"[TWILIO SENT] To: {target_phone}")
                return
        except Exception as exc:
            print(f"[TWILIO ERROR] Failed sending to {clean_mob}: {exc}")

    # 3. Development fallback notice
    print(f"[SMS SERVICE] Notice: SMS gateway not configured. SMS to {clean_mob} queued for simulation.")


def build_challan_email_content(
    challan: models.Challan,
    user: models.User,
    evidence_url: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Builds official Maharashtra Traffic E-Challan plain text and HTML emails.
    """
    vehicle = challan.vehicle
    plate = vehicle.plate_number if vehicle else "N/A"
    model = (vehicle.model if vehicle and vehicle.model else "Motor Vehicle")
    v_type = (vehicle.vehicle_type if vehicle and vehicle.vehicle_type else "Vehicle").capitalize()
    v_time = challan.violation_datetime.strftime("%I:%M %p")
    v_date = challan.violation_datetime.strftime("%d %B %Y")
    fine_val = float(challan.fine_amount)
    fine_str = f"₹{int(fine_val) if fine_val == int(fine_val) else fine_val:,.2f}"
    violation_name = challan.violation_type.name if challan.violation_type else "Traffic Violation"
    legal_section = (challan.violation_type.legal_section if challan.violation_type and challan.violation_type.legal_section else "Motor Vehicles Act, 1988")
    location = challan.location or "Maharashtra State Highway / Urban Division"
    challan_id = str(challan.id)
    view_challan_url = f"{settings.FRONTEND_URL}/verify-receipt/{challan_id}"
    portal_url = f"{settings.FRONTEND_URL}/citizen/challans"

    # Plain text version
    text_body = f"""MAHARASHTRA TRAFFIC POLICE
E-Challan Enforcement & Violation Notice
==================================================

Dear {user.full_name},

An official Traffic E-Challan has been issued for your vehicle under the provisions of the Motor Vehicles Act, 1988.

VEHICLE & VIOLATION DETAILS:
--------------------------------------------------
Registration Number : {plate}
Vehicle Model       : {model} ({v_type})
Challan ID          : {challan_id}
Violation           : {violation_name}
Legal Section       : {legal_section}
Date & Time         : {v_date} at {v_time}
Location            : {location}
Fine Amount         : {fine_str}
Payment Status      : UNPAID / PENDING

ONLINE PAYMENT INSTRUCTIONS:
--------------------------------------------------
To view the photographic violation evidence and pay your challan online:
1. Visit: {view_challan_url}
2. Or login to your Citizen Portal: {portal_url}

Please settle the fine within the statutory period to avoid referral to the Virtual Court / Lok Adalat.

Regards,
Directorate General of Police
Traffic Branch, Maharashtra State
Government of Maharashtra
(This is an electronically generated statutory notice. Do not reply to this email.)
"""

    # Professional HTML version
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Traffic E-Challan Generated - {plate}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
    .header {{ background: #0f2942; padding: 24px; text-align: center; color: #ffffff; border-bottom: 4px solid #d97706; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; }}
    .header p {{ margin: 4px 0 0 0; font-size: 12px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }}
    .badge {{ display: inline-block; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-top: 12px; }}
    .content {{ padding: 28px 24px; color: #1e293b; font-size: 14px; line-height: 1.6; }}
    .plate-card {{ background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; margin: 18px 0; }}
    .plate-card .plate {{ font-family: monospace; font-size: 22px; font-weight: 900; color: #0f2942; background: #fef3c7; border: 1px solid #fde68a; padding: 4px 14px; border-radius: 6px; letter-spacing: 2px; display: inline-block; }}
    .details-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }}
    .details-table td {{ padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }}
    .details-table td.label {{ color: #64748b; font-weight: 600; width: 40%; }}
    .details-table td.val {{ color: #0f172a; font-weight: 700; }}
    .fine-row {{ background: #fff7ed; }}
    .fine-row td {{ color: #9a3412 !important; font-size: 15px; font-weight: 800 !important; }}
    .btn-container {{ text-align: center; margin: 26px 0 10px 0; }}
    .btn {{ background: #d97706; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.25); }}
    .footer {{ background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Maharashtra Traffic Police</h1>
      <p>State E-Challan Enforcement System</p>
      <div class="badge">Official Traffic Violation Notice</div>
    </div>
    <div class="content">
      <p>Dear <strong>{user.full_name}</strong>,</p>
      <p>A traffic violation has been recorded for your vehicle under the provisions of the Motor Vehicles Act, 1988. An official E-Challan has been generated.</p>

      <div class="plate-card">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Registered Vehicle</div>
        <div class="plate">{plate}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 6px; font-weight: 600;">{model} ({v_type})</div>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Challan ID</td>
          <td class="val" style="font-family: monospace;">{challan_id}</td>
        </tr>
        <tr>
          <td class="label">Violation Type</td>
          <td class="val">{violation_name}</td>
        </tr>
        <tr>
          <td class="label">Legal Provision</td>
          <td class="val">{legal_section}</td>
        </tr>
        <tr>
          <td class="label">Date & Time</td>
          <td class="val">{v_date} at {v_time}</td>
        </tr>
        <tr>
          <td class="label">Location</td>
          <td class="val">{location}</td>
        </tr>
        <tr class="fine-row">
          <td class="label" style="color: #9a3412;">Fine Amount</td>
          <td class="val">{fine_str} (UNPAID)</td>
        </tr>
      </table>

      <div class="btn-container">
        <a href="{view_challan_url}" class="btn">View Evidence & Pay Challan</a>
      </div>

      <p style="font-size: 11px; color: #64748b; margin-top: 24px; line-height: 1.5;">
        <strong>Statutory Notice:</strong> Please pay the compounding fine within the prescribed grace period. Unpaid challans may be scheduled for Virtual Court hearing and vehicle registration may be flagged for automated impoundment.
      </p>
    </div>
    <div class="footer">
      Government of Maharashtra • Directorate General of Police (Traffic)<br>
      This is an electronically generated statutory notice. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
"""
    return text_body, html_body


def send_challan_notification(
    db: Session,
    challan: models.Challan,
    user: Optional[models.User] = None,
    evidence_url: Optional[str] = None,
) -> NotificationResult:
    """
    Sends an automated email notification to the vehicle owner when a new challan is generated.
    Returns NotificationResult with delivery details (status: sent | failed | not_available).
    """
    plate = challan.vehicle.plate_number if challan.vehicle else "N/A"
    fine_str = f"₹{int(challan.fine_amount) if challan.fine_amount == int(challan.fine_amount) else challan.fine_amount}"
    challan_id_str = str(challan.id)
    challan_code = challan_id_str[:8].upper()

    print(f"[CHALLAN] Creating challan: CH-{challan_code}")
    print(f"[CHALLAN] Vehicle: {plate}")

    # Resolve Owner if not explicitly passed
    if user is None:
        vehicle = challan.vehicle or (
            db.query(models.Vehicle).filter(models.Vehicle.id == challan.vehicle_id).first()
            if challan.vehicle_id else None
        )
        if vehicle:
            if vehicle.owner:
                user = vehicle.owner
            elif vehicle.owner_id:
                user = db.query(models.User).filter(models.User.id == vehicle.owner_id).first()
            elif vehicle.registered_mobile:
                user = db.query(models.User).filter(models.User.mobile_number == vehicle.registered_mobile).first()

    # 1. Missing Owner or Missing Email
    if not user or not user.email or not user.email.strip():
        if user:
            print(f"[CHALLAN] Owner found: {user.full_name} ({user.id})")
            print(f"[CHALLAN] Owner email not found for vehicle {plate}")
        else:
            print(f"[CHALLAN] Owner not found in registry for vehicle {plate}")
        print("[EMAIL ERROR] Owner email not found")

        if user:
            notif = models.Notification(
                challan_id=challan.id,
                user_id=user.id,
                channel=models.NotificationChannel.email,
                status="not_available",
                message=f"Challan {challan.id}: Owner email not registered for {plate}",
            )
            db.add(notif)
            try:
                db.commit()
            except Exception:
                db.rollback()

        return NotificationResult({
            "success": False,
            "status": "not_available",
            "recipient": None,
            "recipient_email": None,
            "message": "Owner email address is not registered in the system",
            "error": "Owner email address is not registered in the system",
        })

    owner_email = user.email.strip().lower()
    owner_name = user.full_name or "Vehicle Owner"

    print(f"[CHALLAN] Owner found: {owner_name} ({user.id})")
    print(f"[CHALLAN] Owner email found: {owner_email}")

    # 2. Idempotency / Deduplication check: Do not send duplicate emails for the same challan
    existing = (
        db.query(models.Notification)
        .filter(
            models.Notification.challan_id == challan.id,
            models.Notification.channel == models.NotificationChannel.email,
            models.Notification.status == "sent",
        )
        .first()
    )
    if existing:
        print(f"[EMAIL] Challan email for {challan.id} already dispatched to {owner_email} (deduplicated).")
        return NotificationResult({
            "success": True,
            "status": "sent",
            "recipient": owner_email,
            "recipient_email": owner_email,
            "message": "Email already dispatched (deduplicated)",
            "error": None,
        })

    subject = f"Traffic E-Challan Generated - {plate}"
    text_body, html_body = build_challan_email_content(challan, user, evidence_url)

    # 3. Dispatch Email via SMTP
    email_sent, error_msg = send_email_detailed(owner_email, subject, text_body, html_body)

    final_status = "sent" if email_sent else "failed"

    # 4. Record Notification Entry in Database
    notification = models.Notification(
        challan_id=challan.id,
        user_id=user.id,
        channel=models.NotificationChannel.email,
        status=final_status,
        message=f"Challan Generated Notification: {plate} ({challan.id})" + (f" | Error: {error_msg}" if error_msg else ""),
    )
    db.add(notification)

    # In-app notification
    db.add(models.Notification(
        challan_id=challan.id,
        user_id=user.id,
        channel=models.NotificationChannel.in_app,
        status="sent",
        message=f"New challan issued for {plate} — {fine_str}",
    ))

    # Safe SMS dispatch if mobile exists
    if user.mobile_number:
        send_simulated_sms(user.mobile_number, f"Challan issued for {plate}, fine {fine_str}. Challan ID: {challan.id}")

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[NOTIFICATION WARNING] Could not commit notification log: {exc}")

    return NotificationResult({
        "success": email_sent,
        "status": final_status,
        "recipient": owner_email,
        "recipient_email": owner_email,
        "message": "Email sent successfully" if email_sent else (error_msg or "Failed to send email"),
        "error": error_msg if not email_sent else None,
    })


# Backward compatibility alias
notify_challan_created = send_challan_notification


def notify_challan_paid(db: Session, challan: models.Challan, user: models.User, payment: models.Payment) -> bool:
    """
    Sends an automated payment confirmation email to the vehicle owner after successful payment.
    Includes idempotency check to avoid duplicate emails.
    """
    if not user or not user.email:
        return False

    existing = (
        db.query(models.Notification)
        .filter(
            models.Notification.challan_id == challan.id,
            models.Notification.channel == models.NotificationChannel.email,
            models.Notification.message.like("Payment Confirmation%"),
            models.Notification.status == "sent",
        )
        .first()
    )
    if existing:
        return True

    plate = challan.vehicle.plate_number if challan.vehicle else "N/A"
    subject = f"Challan Payment Successful - {challan.id}"
    p_date = payment.paid_at.strftime("%d %B %Y") if payment.paid_at else datetime.utcnow().strftime("%d %B %Y")
    txn_id = payment.razorpay_payment_id or f"TXN_{str(payment.id)[:10].upper()}"
    fine_str = f"₹{int(payment.amount) if payment.amount == int(payment.amount) else payment.amount}"

    view_receipt_url = f"{settings.FRONTEND_URL}/verify-receipt/{challan.id}"

    body = (
        f"Subject: {subject}\n\n"
        f"Hello {user.full_name},\n\n"
        f"Your traffic challan payment has been successfully completed.\n\n"
        f"Challan ID:\n{challan.id}\n\n"
        f"Vehicle Number:\n{plate}\n\n"
        f"Violation:\n{challan.violation_type.name}\n\n"
        f"Amount Paid:\n{fine_str}\n\n"
        f"Payment Date:\n{p_date}\n\n"
        f"Transaction ID:\n{txn_id}\n\n"
        f"Status:\nPAID\n\n"
        f"You can log in to your account to view or download your payment receipt.\n\n"
        f"View Receipt: {view_receipt_url}\n\n"
        f"Regards,\n"
        f"Traffic Challan Management System"
    )

    try:
        email_sent = send_email(user.email, subject, body)
    except Exception as exc:
        print(f"[NOTIFICATION WARNING] Payment confirmation email error: {exc}")
        email_sent = False

    notification = models.Notification(
        challan_id=challan.id,
        user_id=user.id,
        channel=models.NotificationChannel.email,
        status="sent" if email_sent else "failed",
        message=f"Payment Confirmation: {challan.id}",
    )
    db.add(notification)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return email_sent
