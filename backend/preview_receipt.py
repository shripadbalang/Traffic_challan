import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.routers.payments import _draw_receipt_card
from app.config import settings
import qrcode

os.makedirs(settings.RECEIPT_STORAGE_PATH, exist_ok=True)

qr_path = os.path.join(settings.RECEIPT_STORAGE_PATH, "preview_qr.png")
qrcode.make("https://example.com/verify/preview").save(qr_path)

pdf_path = os.path.join(settings.RECEIPT_STORAGE_PATH, "preview_receipt.pdf")

_draw_receipt_card(
    pdf_path=pdf_path,
    qr_path=qr_path,
    challan_no="MH-27-2026-9812",
    vehicle_no="MH 27 AB 1234",
    violations=[("Without Helmet", 1000.0), ("Triple Seat Riding", 1000.0)],
    total_fine=2000.0,
    is_paid=False,
)

print(f"Preview saved to: {pdf_path}")
print("Open that file to see the design.")