import os
import sys
import uuid
import re
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app import models, schemas
from app.core.security import hash_password, create_access_token

# In-memory SQLite for testing
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

print("=" * 60)
print("     OWNER PORTAL ARCHITECTURE & SECURITY TEST SUITE")
print("=" * 60)

# 1. Setup seed data: RTO vehicles and violation types
db = TestingSessionLocal()

vt_helmet = models.ViolationType(
    id=str(uuid.uuid4()), code="NO_HELMET", name="Riding without helmet", base_fine_amount=500.0, legal_section="Sec 194D"
)
vt_phone = models.ViolationType(
    id=str(uuid.uuid4()), code="MOBILE_PHONE_USAGE", name="Using mobile while driving", base_fine_amount=1000.0, legal_section="Sec 184"
)
db.add_all([vt_helmet, vt_phone])

# Seed RTO registry vehicles
v1 = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH37AB0949",
    vehicle_type="motorcycle",
    model="Honda Activa 6G",
    rto_code="MH37",
    registered_mobile="9800000001",  # Will belong to Payal
    registration_date=datetime.utcnow() - timedelta(days=300),
)
v2 = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH27XY1234",
    vehicle_type="motorcycle",
    model="Yamaha FZ-S",
    rto_code="MH27",
    registered_mobile="9800000001",  # Also Payal's vehicle
    registration_date=datetime.utcnow() - timedelta(days=200),
)
v3 = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12AB9999",
    vehicle_type="car",
    model="Tata Nexon",
    rto_code="MH12",
    registered_mobile="9800000002",  # Belongs to another citizen
    registration_date=datetime.utcnow() - timedelta(days=150),
)
db.add_all([v1, v2, v3])
db.commit()

# Challans
ch1_id = str(uuid.uuid4())
ch2_id = str(uuid.uuid4())
ch_other_id = str(uuid.uuid4())

ch1 = models.Challan(
    id=ch1_id,
    vehicle_id=v1.id,
    violation_type_id=vt_helmet.id,
    detection_source=models.DetectionSource.ai,
    fine_amount=500.0,
    status=models.ChallanStatus.pending,
    location="Amravati Road, Washim",
    violation_datetime=datetime(2026, 9, 24, 10, 32),
)
ch2 = models.Challan(
    id=ch2_id,
    vehicle_id=v2.id,
    violation_type_id=vt_phone.id,
    detection_source=models.DetectionSource.ai,
    fine_amount=1000.0,
    status=models.ChallanStatus.pending,
    location="Camp Road, Amravati",
    violation_datetime=datetime(2026, 9, 24, 11, 15),
)
ch_other = models.Challan(
    id=ch_other_id,
    vehicle_id=v3.id,
    violation_type_id=vt_helmet.id,
    detection_source=models.DetectionSource.manual,
    fine_amount=500.0,
    status=models.ChallanStatus.pending,
    location="FC Road, Pune",
    violation_datetime=datetime(2026, 9, 23, 14, 0),
)
db.add_all([ch1, ch2, ch_other])
db.commit()

# ----------------- TEST 1: Registration Flow & OTP Verification -----------------
print("\n[Step 1] Owner Registration & OTP Verification...")
reg_init_res = client.post("/auth/owner/register-initiate", json={
    "full_name": "Payal Sune",
    "email": "payal@example.com",
    "mobile_number": "9800000001",
})
assert reg_init_res.status_code == 200, f"Expected 200, got {reg_init_res.status_code}: {reg_init_res.text}"
assert "otp" not in reg_init_res.json(), "Security leak: OTP must not be in response body!"

# Fetch generated OTP from test database
otp_row = db.query(models.OtpCode).filter(models.OtpCode.mobile_number == "9800000001").order_by(models.OtpCode.created_at.desc()).first()
assert otp_row is not None
otp_code = otp_row.code

# Reject incorrect OTP
wrong_otp_res = client.post("/auth/owner/register-verify", json={
    "full_name": "Payal Sune",
    "email": "payal@example.com",
    "mobile_number": "9800000001",
    "code": "000000",
})
assert wrong_otp_res.status_code == 400
assert "Incorrect OTP" in wrong_otp_res.json()["detail"]

# Successful OTP verification
reg_verify_res = client.post("/auth/owner/register-verify", json={
    "full_name": "Payal Sune",
    "email": "payal@example.com",
    "mobile_number": "9800000001",
    "code": otp_code,
})
assert reg_verify_res.status_code == 200, f"Verify failed: {reg_verify_res.text}"
payal_token = reg_verify_res.json()["access_token"]
payal_user = reg_verify_res.json()["user"]
payal_headers = {"Authorization": f"Bearer {payal_token}"}
print("  [+] PASS: Payal account registered & verified successfully via OTP.")

# Cannot reuse already-used OTP
reuse_res = client.post("/auth/owner/register-verify", json={
    "full_name": "Payal Sune",
    "email": "payal@example.com",
    "mobile_number": "9800000001",
    "code": otp_code,
})
assert reuse_res.status_code == 400
print("  [+] PASS: Replay of used OTP correctly rejected.")

# ----------------- TEST 2: Existing User Login via OTP -----------------
print("\n[Step 2] Existing User Login Flow...")
login_init_res = client.post("/auth/owner/login-initiate", json={"identifier": "payal@example.com"})
assert login_init_res.status_code == 200
login_otp = db.query(models.OtpCode).filter(models.OtpCode.email == "payal@example.com", models.OtpCode.is_used == False).order_by(models.OtpCode.created_at.desc()).first().code

login_verify_res = client.post("/auth/owner/login-verify", json={"identifier": "payal@example.com", "code": login_otp})
assert login_verify_res.status_code == 200
assert "access_token" in login_verify_res.json()
print("  [+] PASS: Existing user logged in with OTP.")

# ----------------- TEST 3: Add Vehicle & Ownership Verification Security -----------------
print("\n[Step 3] Vehicle Ownership Verification & Linking...")

# Mismatched mobile number must be rejected
mismatch_res = client.post("/vehicles/add", json={
    "vehicle_number": "MH37AB0949",
    "registered_mobile": "9999999999",  # Wrong mobile
}, headers=payal_headers)
assert mismatch_res.status_code in (400, 403, 404)
assert "do not match our records" in mismatch_res.json()["detail"]
print("  [+] PASS: Mismatched mobile rejected with exact security message.")

# Nonexistent vehicle must be rejected
nonexist_res = client.post("/vehicles/add", json={
    "vehicle_number": "MH99ZZ9999",
    "registered_mobile": "9800000001",
}, headers=payal_headers)
assert nonexist_res.status_code == 404
assert "do not match our records" in nonexist_res.json()["detail"]
print("  [+] PASS: Nonexistent vehicle rejected without leaking internal info.")

# Successfully add first vehicle
add_res = client.post("/vehicles/add", json={
    "vehicle_number": "MH 37 AB 0949",
    "registered_mobile": "9800000001",
}, headers=payal_headers)
assert add_res.status_code == 200
assert add_res.json()["plate_number"] == "MH37AB0949"
assert add_res.json()["pending_challans"] == 1
assert add_res.json()["total_challan_amount"] == 500.0
print("  [+] PASS: MH 37 AB 0949 successfully linked to Payal's account.")

# Cannot add same vehicle twice
dup_res = client.post("/vehicles/add", json={
    "vehicle_number": "MH37AB0949",
    "registered_mobile": "9800000001",
}, headers=payal_headers)
assert dup_res.status_code == 400
assert "already linked" in dup_res.json()["detail"]
print("  [+] PASS: Duplicate vehicle linking blocked.")

# Add second vehicle
client.post("/vehicles/add", json={
    "vehicle_number": "MH 27 XY 1234",
    "registered_mobile": "9800000001",
}, headers=payal_headers)

# ----------------- TEST 4: Unauthorized User Isolation (User B) -----------------
print("\n[Step 4] Critical Data Isolation between Users...")
# Register User B
reg_b = client.post("/auth/owner/register-initiate", json={
    "full_name": "Rohan Deshmukh",
    "email": "rohan@example.com",
    "mobile_number": "9800000002",
})
b_otp = db.query(models.OtpCode).filter(models.OtpCode.mobile_number == "9800000002").order_by(models.OtpCode.created_at.desc()).first().code
reg_b_ver = client.post("/auth/owner/register-verify", json={
    "full_name": "Rohan Deshmukh",
    "email": "rohan@example.com",
    "mobile_number": "9800000002",
    "code": b_otp,
})
rohan_token = reg_b_ver.json()["access_token"]
rohan_headers = {"Authorization": f"Bearer {rohan_token}"}

# User B cannot link Payal's vehicle
hijack_res = client.post("/vehicles/add", json={
    "vehicle_number": "MH37AB0949",
    "registered_mobile": "9800000001",
}, headers=rohan_headers)
assert hijack_res.status_code in (400, 403)
print("  [+] PASS: User B blocked from claiming User A's vehicle.")

# User B cannot view Payal's vehicle details
veh_det_b = client.get("/vehicles/MH37AB0949/details", headers=rohan_headers)
assert veh_det_b.status_code == 403
print("  [+] PASS: User B blocked from viewing User A's vehicle details (HTTP 403).")

# User B cannot view Payal's challan details
ch_det_b = client.get(f"/challans/{ch1_id}", headers=rohan_headers)
assert ch_det_b.status_code == 403
print("  [+] PASS: User B blocked from viewing User A's challan (HTTP 403).")

# ----------------- TEST 5: My Vehicles & My Challans Isolation -----------------
print("\n[Step 5] Checking My Vehicles & My Challans...")
my_veh_res = client.get("/vehicles/my", headers=payal_headers)
assert my_veh_res.status_code == 200
plates = [v["plate_number"] for v in my_veh_res.json()]
assert "MH37AB0949" in plates
assert "MH27XY1234" in plates
assert "MH12AB9999" not in plates
print(f"  [+] PASS: Payal sees only her 2 vehicles: {plates}")

my_ch_res = client.get("/challans/my", headers=payal_headers)
assert my_ch_res.status_code == 200
ch_ids = [c["id"] for c in my_ch_res.json()]
assert ch1_id in ch_ids
assert ch2_id in ch_ids
assert ch_other_id not in ch_ids
print(f"  [+] PASS: Payal sees only her 2 challans: {ch_ids}")

# ----------------- TEST 6: Payment Flow & 1-Page Receipt with QR -----------------
print("\n[Step 6] Payment Flow, Verification & Receipt Generation...")
init_pay = client.post("/payments/initiate", json={"challan_id": ch1_id}, headers=payal_headers)
assert init_pay.status_code == 200
order_id = init_pay.json()["order_id"]

ver_pay = client.post("/payments/verify", json={
    "challan_id": ch1_id,
    "razorpay_order_id": order_id,
    "razorpay_payment_id": "PAY_MH_TEST_10021",
    "razorpay_signature": "mock_sig",
}, headers=payal_headers)
assert ver_pay.status_code == 200
print("  [+] PASS: Payment verified by backend, Challan marked as PAID.")

# Check challan status is now PAID
ch_after = client.get(f"/challans/{ch1_id}", headers=payal_headers).json()
assert ch_after["status"] == "paid"

# Duplicate payment is rejected
dup_pay = client.post("/payments/initiate", json={"challan_id": ch1_id}, headers=payal_headers)
assert dup_pay.status_code == 400
print("  [+] PASS: Duplicate payment initiation blocked on settled challan.")

# Get receipt
receipt_res = client.get(f"/payments/receipt/{ch1_id}", headers=payal_headers)
assert receipt_res.status_code == 200
receipt_data = receipt_res.json()
assert receipt_data["payment_status"] == "PAID"
assert receipt_data["owner_name"] == "Payal Sune"
assert receipt_data["vehicle_plate"] == "MH37AB0949"
assert "pdf_url" in receipt_data
assert "qr_url" in receipt_data
print("  [+] PASS: Receipt generated with QR code and all required metadata.")

# Public receipt verification endpoint (accessible without login)
public_res = client.get(f"/payments/verify-public/{ch1_id}")
assert public_res.status_code == 200
assert public_res.json()["status"] == "PAID"
assert public_res.json()["vehicle_number"] == "MH37AB0949"
print("  [+] PASS: Public QR verification endpoint confirms status without auth.")

# ----------------- TEST 7: Profile & Role Security -----------------
print("\n[Step 7] Profile Page & Role Isolation...")
prof_res = client.get("/users/profile", headers=payal_headers)
assert prof_res.status_code == 200
assert prof_res.json()["full_name"] == "Payal Sune"
assert prof_res.json()["role"] == "owner"

# Owner cannot access Admin endpoints
admin_res = client.get("/admin/analytics/overview", headers=payal_headers)
assert admin_res.status_code == 403
print("  [+] PASS: Owner access to Admin dashboard blocked (HTTP 403).")

# Owner cannot access Officer manual challan creation
off_res = client.post("/challans/manual", json={
    "plate_number": "MH37AB0949",
    "violation_code": "NO_HELMET",
}, headers=payal_headers)
assert off_res.status_code == 403
print("  [+] PASS: Owner access to Officer manual challan blocked (HTTP 403).")

# ----------------- TEST 8: Vehicle Unlinking / Removal & IDOR Protection -----------------
print("\n[Step 8] Vehicle Unlinking & IDOR Protection...")

# 8.1: User B attempts to unlink Payal's vehicle (IDOR attack) -> MUST return 403
idor_del = client.delete("/vehicles/MH37AB0949", headers=rohan_headers)
assert idor_del.status_code == 403, f"Expected 403 Forbidden for IDOR attempt, got {idor_del.status_code}"
assert "not authorized" in idor_del.json()["detail"].lower()
print("  [+] PASS: User B blocked from unlinking User A's vehicle (HTTP 403 Forbidden).")

# 8.2: Attempt to unlink nonexistent vehicle -> 404
nonexist_del = client.delete("/vehicles/MH99ZZ9999", headers=payal_headers)
assert nonexist_del.status_code == 404
print("  [+] PASS: Unlinking nonexistent vehicle returns HTTP 404.")

# 8.3: Payal unlinks her vehicle MH37AB0949
del_res = client.delete("/vehicles/MH 37 AB 0949", headers=payal_headers)
assert del_res.status_code == 200
assert del_res.json()["plate_number"] == "MH37AB0949"
print(f"  [+] PASS: Payal unlinked vehicle MH37AB0949: {del_res.json()['message']}")

# 8.4: Verify vehicle is no longer in Payal's active My Vehicles list
my_veh_after = client.get("/vehicles/my", headers=payal_headers)
assert my_veh_after.status_code == 200
remaining_plates = [v["plate_number"] for v in my_veh_after.json()]
assert "MH37AB0949" not in remaining_plates, "Unlinked vehicle should not appear in active vehicles list"
assert "MH27XY1234" in remaining_plates
print(f"  [+] PASS: Active vehicles list updated cleanly: {remaining_plates}")

# 8.5: Verify data preservation in database (NO hard delete)
veh_row = db.query(models.Vehicle).filter(models.Vehicle.plate_number == "MH37AB0949").first()
assert veh_row is not None, "Vehicle record must be preserved in central registry"
assert veh_row.owner_id is None, "Vehicle owner_id must be unlinked (set to None)"

ch_row = db.query(models.Challan).filter(models.Challan.id == ch1_id).first()
assert ch_row is not None, "Historical challan record must NOT be deleted"
assert ch_row.status == models.ChallanStatus.paid

pmt_row = db.query(models.Payment).filter(models.Payment.challan_id == ch1_id).first()
assert pmt_row is not None, "Payment and receipt transaction records must NOT be deleted"

# 8.6: Public QR verification still functions for the unlinked vehicle's past receipt
public_check = client.get(f"/payments/verify-public/{ch1_id}")
assert public_check.status_code == 200
assert public_check.json()["status"] == "PAID"
assert public_check.json()["vehicle_number"] == "MH37AB0949"
print("  [+] PASS: Historical challan, payment, and public verification records 100% intact.")

# ----------------- TEST 9: Notification Templates & Resilient Dispatch -----------------
print("\n[Step 9] Notification Templates & Non-blocking Email Dispatch...")
from app.services import notification_service

payal_db_user = db.query(models.User).filter(models.User.email == "payal@example.com").first()
assert payal_db_user is not None

# Test Challan Created Notification
challan_notif = notification_service.notify_challan_created(db, ch_row, payal_db_user)
print("  [+] PASS: notify_challan_created formatted and executed cleanly.")

# Test Challan Paid Notification
paid_notif = notification_service.notify_challan_paid(db, ch_row, payal_db_user, pmt_row)
print("  [+] PASS: notify_challan_paid formatted and executed cleanly.")

# Verify notifications recorded in database
notifs = db.query(models.Notification).filter(models.Notification.user_id == payal_db_user.id).all()
assert len(notifs) >= 1
print(f"  [+] PASS: Notification dispatch logged in audit database: {len(notifs)} records.")

print("\n" + "=" * 60)
print("  >>> ALL OWNER PORTAL ARCHITECTURE & SECURITY TESTS PASSED! <<<")
print("=" * 60)
