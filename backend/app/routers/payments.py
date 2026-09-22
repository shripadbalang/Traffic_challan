import os
import hmac
import hashlib
from datetime import datetime

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.core.security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

try:
    import razorpay
    razorpay_client = (
        razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        if settings.RAZORPAY_KEY_ID else None
    )
except ImportError:
    razorpay_client = None


@router.post("/initiate")
def initiate_payment(
    payload: schemas.PaymentInitiateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    challan = db.query(models.Challan).filter(models.Challan.id == payload.challan_id).first()
    if not challan or challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Challan not found")
    if challan.status == models.ChallanStatus.paid:
        raise HTTPException(status_code=400, detail="Challan already paid")

    amount_paise = int(float(challan.fine_amount) * 100)

    if razorpay_client:
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"challan_{challan.id}",
        })
        order_id = order["id"]
    else:
        # Fallback: fully mocked order (no Razorpay keys configured yet)
        order_id = f"mock_order_{challan.id}"

    payment = models.Payment(
        challan_id=challan.id,
        amount=challan.fine_amount,
        status="initiated",
        razorpay_order_id=order_id,
    )
    db.add(payment)
    db.commit()

    return {
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or None,
        "mock_mode": razorpay_client is None,
    }


@router.post("/verify")
def verify_payment(
    payload: schemas.PaymentVerifyRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    challan = db.query(models.Challan).filter(models.Challan.id == payload.challan_id).first()
    if not challan or challan.vehicle.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Challan not found")

    payment = challan.payment
    if not payment:
        raise HTTPException(status_code=400, detail="No payment initiated for this challan")

    if razorpay_client:
        try:
            razorpay_client.utility.verify_payment_signature({
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            })
        except razorpay.errors.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Payment signature verification failed")
    # else: mock mode — trust client confirmation (fine for a local demo only)

    payment.status = "success"
    payment.razorpay_payment_id = payload.razorpay_payment_id
    payment.paid_at = datetime.utcnow()
    challan.status = models.ChallanStatus.paid

    receipt_pdf_path, qr_path = _generate_receipt(challan, payment)
    payment.receipt_pdf_path = receipt_pdf_path
    payment.receipt_qr_path = qr_path

    db.commit()

    return {"message": "Payment verified successfully", "receipt_pdf_path": receipt_pdf_path}


def _generate_receipt(challan: models.Challan, payment: models.Payment):
    os.makedirs(settings.RECEIPT_STORAGE_PATH, exist_ok=True)

    verify_url = f"{settings.FRONTEND_URL}/verify-receipt/{challan.id}"
    qr_img = qrcode.make(verify_url)
    qr_path = os.path.join(settings.RECEIPT_STORAGE_PATH, f"{challan.id}_qr.png")
    qr_img.save(qr_path)

    pdf_path = os.path.join(settings.RECEIPT_STORAGE_PATH, f"{challan.id}_receipt.pdf")
    _draw_receipt_card(
        pdf_path=pdf_path,
        qr_path=qr_path,
        challan_no=challan.id,
        vehicle_no=challan.vehicle.plate_number,
        violations=[(challan.violation_type.name, float(payment.amount))],
        total_fine=float(payment.amount),
        is_paid=True,
    )
    return pdf_path, qr_path


def _draw_receipt_card(pdf_path, qr_path, challan_no, vehicle_no, violations, total_fine, is_paid):
    """Draws a card-style E-Challan receipt: dark header with icon,
    labeled rows, a violations list, bold total, and a status pill."""
    PAGE_W, PAGE_H = 380, 560
    MARGIN = 28
    HEADER_H = 120

    NAVY = HexColor("#1e2530")
    GRAY_LABEL = HexColor("#8a8f98")
    GREEN = HexColor("#16a34a")
    ORANGE = HexColor("#d97706")

    c = canvas.Canvas(pdf_path, pagesize=(PAGE_W, PAGE_H))

    # ---- Header ----
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)

    # Simple building/government icon (roof + base + columns), centered
    icon_cx = PAGE_W / 2
    icon_top = PAGE_H - 28
    c.setFillColor(white)
    c.setStrokeColor(white)
    # roof triangle
    c.line(icon_cx - 22, icon_top - 12, icon_cx, icon_top)
    c.line(icon_cx, icon_top, icon_cx + 22, icon_top - 12)
    c.line(icon_cx - 22, icon_top - 12, icon_cx + 22, icon_top - 12)
    # base
    c.rect(icon_cx - 24, icon_top - 34, 48, 4, fill=1, stroke=0)
    # columns
    for dx in (-16, -6, 6, 16):
        c.rect(icon_cx + dx - 1.5, icon_top - 32, 3, 20, fill=1, stroke=0)

    # Title + subtitle
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(white)
    c.drawCentredString(icon_cx, icon_top - 52, "E-Challan Receipt")
    c.setFont("Helvetica", 9)
    c.drawCentredString(icon_cx, icon_top - 66, "Traffic Police Department, Maharashtra")

    # ---- Body ----
    y = PAGE_H - HEADER_H - 36

    def label_value_row(label, value, y_pos, bold_value=True, value_size=11):
        c.setFont("Helvetica", 10)
        c.setFillColor(GRAY_LABEL)
        c.drawString(MARGIN, y_pos, label)
        c.setFont("Helvetica-Bold" if bold_value else "Helvetica", value_size)
        c.setFillColor(HexColor("#111111"))
        c.drawRightString(PAGE_W - MARGIN, y_pos, str(value))

    label_value_row("Challan No:", challan_no, y)
    y -= 24
    label_value_row("Vehicle No:", vehicle_no, y)
    y -= 20

    c.setStrokeColor(HexColor("#e5e7eb"))
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 22

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(HexColor("#111111"))
    c.drawString(MARGIN, y, "Violations Detected:")
    y -= 20

    for idx, (name, amount) in enumerate(violations, start=1):
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#333333"))
        c.drawString(MARGIN + 4, y, f"{idx}. {name}")
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(PAGE_W - MARGIN, y, f"Rs. {amount:,.2f}")
        y -= 20

    y -= 4
    c.setStrokeColor(HexColor("#e5e7eb"))
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 28

    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(HexColor("#111111"))
    c.drawString(MARGIN, y, "Total Fine")
    c.drawRightString(PAGE_W - MARGIN, y, f"Rs. {total_fine:,.2f}")
    y -= 44

    # ---- Status pill ----
    pill_color = GREEN if is_paid else ORANGE
    pill_text = "Status: Paid" if is_paid else "Status: Pending Payment"
    pill_w, pill_h = 200, 30
    pill_x = (PAGE_W - pill_w) / 2
    c.setFillColor(pill_color)
    c.roundRect(pill_x, y - pill_h, pill_w, pill_h, radius=6, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(PAGE_W / 2, y - pill_h + 10, pill_text)
    y -= (pill_h + 30)

    # ---- QR code ----
    qr_size = 90
    c.drawImage(qr_path, (PAGE_W - qr_size) / 2, y - qr_size, width=qr_size, height=qr_size)
    y -= (qr_size + 14)
    c.setFont("Helvetica", 8)
    c.setFillColor(GRAY_LABEL)
    c.drawCentredString(PAGE_W / 2, y, "Scan to verify this receipt online")

    c.save()