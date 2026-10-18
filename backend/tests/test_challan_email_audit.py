"""
Comprehensive End-to-End Test Suite for Challan Email Notification System.
Tests Tasks 1 through 15:
- Test 1: Valid challan creation for vehicle with registered owner email
- Test 2: Vehicle exists but owner has no email (not_available status)
- Test 3: Invalid/malformed owner email handling
- Test 4: SMTP authentication failure handling (safe error, no crash, no leak)
- Test 5: Duplicate email protection / deduplication
- Test 6: Officer capture-and-detect flow end-to-end
- Test 7: Manual challan creation flow end-to-end
- Test 8: AI violation detection flow end-to-end (/violations/detect)
"""
import os
import sys
import uuid
from io import BytesIO
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app import models, schemas
from app.core.security import hash_password, create_access_token
from app.services.notification_service import (
    send_challan_notification,
    notify_challan_created,
    send_email_detailed,
    NotificationResult,
)
from app.services.challan_engine import create_challan

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

print("=" * 70)
print("     TRAFFIC CHALLAN EMAIL SYSTEM END-TO-END AUDIT & TEST SUITE")
print("=" * 70)

# Setup initial test database
db = TestingSessionLocal()

# 1. Violation Types
vt_helmet = models.ViolationType(
    id=str(uuid.uuid4()),
    code="NO_HELMET",
    name="Riding without helmet",
    base_fine_amount=500.0,
    legal_section="Sec 194D MVA",
)
vt_speed = models.ViolationType(
    id=str(uuid.uuid4()),
    code="OVERSPEEDING",
    name="Dangerous driving / Speed violation",
    base_fine_amount=1000.0,
    legal_section="Sec 183 MVA",
)
db.add_all([vt_helmet, vt_speed])

# 2. Officer Account & Profile
officer_user = models.User(
    id=str(uuid.uuid4()),
    full_name="Inspector Vikram Shinde",
    email="officer.vikram@traffic.gov.in",
    mobile_number="9800000099",
    role=models.UserRole.officer,
    is_verified=True,
)
db.add(officer_user)
db.flush()

officer_profile = models.Officer(
    id=str(uuid.uuid4()),
    user_id=officer_user.id,
    badge_number="MH-PUN-9999",
    jurisdiction="Pune Traffic Branch",
)
db.add(officer_profile)

# 3. Test Owners and Vehicles
# Owner 1: Valid email
owner_valid = models.User(
    id=str(uuid.uuid4()),
    full_name="Rajesh Sharma",
    email="rajesh.sharma@example.com",
    mobile_number="9811111111",
    role=models.UserRole.citizen,
    is_verified=True,
)
# Owner 2: No email registered
owner_no_email = models.User(
    id=str(uuid.uuid4()),
    full_name="Sunil Pawar",
    email=None,
    mobile_number="9822222222",
    role=models.UserRole.citizen,
    is_verified=True,
)
# Owner 3: Malformed email
owner_bad_email = models.User(
    id=str(uuid.uuid4()),
    full_name="Anil Kadam",
    email="invalid-email-format",
    mobile_number="9833333333",
    role=models.UserRole.citizen,
    is_verified=True,
)
db.add_all([owner_valid, owner_no_email, owner_bad_email])
db.flush()

veh_valid = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12AB1001",
    vehicle_type="motorcycle",
    model="Hero Splendor",
    owner_id=owner_valid.id,
    registered_mobile=owner_valid.mobile_number,
)
veh_no_email = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12CD2002",
    vehicle_type="motorcycle",
    model="Bajaj Pulsar",
    owner_id=owner_no_email.id,
    registered_mobile=owner_no_email.mobile_number,
)
veh_bad_email = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12EF3003",
    vehicle_type="motorcycle",
    model="TVS Apache",
    owner_id=owner_bad_email.id,
    registered_mobile=owner_bad_email.mobile_number,
)
db.add_all([veh_valid, veh_no_email, veh_bad_email])
db.commit()

officer_token = create_access_token(officer_user.id, "officer")
officer_headers = {"Authorization": f"Bearer {officer_token}"}

# -------------------------------------------------------------
# TEST 1: Valid challan creation for vehicle with registered owner email
# -------------------------------------------------------------
print("\n>>> TEST 1: Valid Challan with Registered Owner Email")
with patch("app.services.notification_service.send_email_detailed") as mock_send:
    mock_send.return_value = (True, None)

    ch1 = create_challan(
        db=db,
        vehicle=veh_valid,
        violation_type=vt_helmet,
        detection_source=models.DetectionSource.manual,
        officer_id=officer_profile.id,
        location="FC Road, Pune",
    )
    res1 = send_challan_notification(db, ch1, owner_valid)

    assert res1.success is True, f"Expected success True, got {res1.success}"
    assert res1.status == "sent", f"Expected status 'sent', got {res1.status}"
    assert res1.recipient == "rajesh.sharma@example.com"
    assert res1.recipient_email == "rajesh.sharma@example.com"
    assert res1.error is None
    assert bool(res1) is True

    # Verify notification record stored in database
    notif1 = (
        db.query(models.Notification)
        .filter(models.Notification.challan_id == ch1.id, models.Notification.channel == models.NotificationChannel.email)
        .first()
    )
    assert notif1 is not None, "Notification record missing from DB"
    assert notif1.status == "sent"
    assert notif1.user_id == owner_valid.id
    print("  [+] PASS: Challan created and email dispatch recorded with status 'sent'.")

# -------------------------------------------------------------
# TEST 2: Vehicle exists but owner has no email
# -------------------------------------------------------------
print("\n>>> TEST 2: Vehicle Exists But Owner Has No Email")
with patch("app.services.notification_service.send_email_detailed") as mock_send:
    ch2 = create_challan(
        db=db,
        vehicle=veh_no_email,
        violation_type=vt_helmet,
        detection_source=models.DetectionSource.manual,
        officer_id=officer_profile.id,
        location="JM Road, Pune",
    )
    res2 = send_challan_notification(db, ch2, owner_no_email)

    assert res2.success is False
    assert res2.status == "not_available"
    assert res2.recipient is None
    assert bool(res2) is False
    mock_send.assert_not_called()

    # Verify notification record in DB
    notif2 = (
        db.query(models.Notification)
        .filter(models.Notification.challan_id == ch2.id, models.Notification.channel == models.NotificationChannel.email)
        .first()
    )
    assert notif2 is not None
    assert notif2.status == "not_available"
    print("  [+] PASS: Owner without email safely marked 'not_available' without attempting SMTP send.")

# -------------------------------------------------------------
# TEST 3: Invalid / malformed owner email
# -------------------------------------------------------------
print("\n>>> TEST 3: Invalid / Malformed Owner Email")
ch3 = create_challan(
    db=db,
    vehicle=veh_bad_email,
    violation_type=vt_helmet,
    detection_source=models.DetectionSource.manual,
    officer_id=officer_profile.id,
    location="Baner Road, Pune",
)
res3 = send_challan_notification(db, ch3, owner_bad_email)

assert res3.success is False
assert res3.status == "failed"
assert "Invalid recipient" in res3.error
assert bool(res3) is False
print("  [+] PASS: Malformed email address rejected safely without crashing.")

# -------------------------------------------------------------
# TEST 4: SMTP Authentication Failure Handling
# -------------------------------------------------------------
print("\n>>> TEST 4: SMTP Authentication Failure Handling")
with patch("app.services.notification_service.send_email_detailed") as mock_send:
    mock_send.return_value = (False, "SMTP authentication failed: Invalid username or App Password.")

    ch4 = create_challan(
        db=db,
        vehicle=veh_valid,
        violation_type=vt_helmet,
        detection_source=models.DetectionSource.manual,
        officer_id=officer_profile.id,
        location="Kothrud, Pune",
    )
    res4 = send_challan_notification(db, ch4, owner_valid)

    assert res4.success is False
    assert res4.status == "failed"
    assert "SMTP authentication failed" in res4.error

    # Verify challan was NOT rolled back
    ch4_check = db.query(models.Challan).filter(models.Challan.id == ch4.id).first()
    assert ch4_check is not None
    print("  [+] PASS: SMTP failure captured cleanly; challan preserved in DB.")

# -------------------------------------------------------------
# TEST 5: Duplicate Email Protection / Deduplication
# -------------------------------------------------------------
print("\n>>> TEST 5: Duplicate Email Protection / Deduplication")
with patch("app.services.notification_service.send_email_detailed") as mock_send:
    mock_send.return_value = (True, None)

    # First call dispatches
    res5_first = send_challan_notification(db, ch1, owner_valid)
    # ch1 already has status='sent' from TEST 1
    assert res5_first.success is True
    assert res5_first.status == "sent"
    # mock_send should NOT have been called because ch1 was already 'sent'
    mock_send.assert_not_called()
    print("  [+] PASS: Duplicate send for previously sent challan successfully deduplicated.")

# -------------------------------------------------------------
# TEST 6: Officer Capture-and-Detect Flow End-to-End
# -------------------------------------------------------------
# -------------------------------------------------------------
# TEST 6: Officer Capture-and-Detect Flow End-to-End
# -------------------------------------------------------------
print("\n>>> TEST 6: Officer Capture-and-Detect Flow End-to-End")
owner_officer = models.User(
    id=str(uuid.uuid4()),
    full_name="Pooja Verma",
    email="pooja.verma@example.com",
    mobile_number="9844444444",
    role=models.UserRole.citizen,
    is_verified=True,
)
db.add(owner_officer)
db.flush()
veh_officer = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12ZZ8888",
    vehicle_type="motorcycle",
    model="Yamaha FZ",
    owner_id=owner_officer.id,
    registered_mobile=owner_officer.mobile_number,
)
db.add(veh_officer)
db.commit()

mock_detection = schemas.DetectionResult(
    violations_found=["no_helmet"],
    plate_number="MH12ZZ8888",
    plate_confidence=0.98,
    detected_vehicles=[
        schemas.DetectedVehicle(
            vehicle_id=1,
            vehicle_type="motorcycle",
            plate_number="MH12ZZ8888",
            plate_confidence=0.98,
            violations_found=["no_helmet"],
        )
    ],
    boxes=[schemas.DetectionBox(class_name="no_helmet", confidence=0.98, bbox=[10, 10, 50, 50])],
)

dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

with patch("app.routers.officer.run_detection", return_value=mock_detection):
    with patch("app.services.notification_service.send_email_detailed") as mock_email:
        mock_email.return_value = (True, None)

        res_officer = client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("plate.jpg", dummy_img, "image/jpeg")},
            data={"vehicle_plate": "MH12ZZ8888"},
            headers=officer_headers,
        )

        assert res_officer.status_code == 200, f"Error: {res_officer.text}"
        data = res_officer.json()
        assert data["status"] == "VIOLATION_DETECTED"
        assert data["success"] is True
        assert data["email_status"] == "sent"
        assert data["email_sent"] is True
        assert data["recipient_email"] == "pooja.verma@example.com"
        assert len(data["violations"]) == 1
        assert data["violations"][0]["email_status"] == "sent"
        print("  [+] PASS: Officer capture-and-detect returned email_status='sent' and recipient_email.")

# -------------------------------------------------------------
# TEST 7: Manual Challan Creation Flow End-to-End
# -------------------------------------------------------------
print("\n>>> TEST 7: Manual Challan Creation Flow End-to-End")
owner_manual = models.User(
    id=str(uuid.uuid4()),
    full_name="Manoj Patil",
    email="manoj.patil@example.com",
    mobile_number="9855555555",
    role=models.UserRole.citizen,
    is_verified=True,
)
db.add(owner_manual)
db.flush()
veh_manual = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12MN5555",
    vehicle_type="motorcycle",
    model="Bajaj Avenger",
    owner_id=owner_manual.id,
    registered_mobile=owner_manual.mobile_number,
)
db.add(veh_manual)
db.commit()

with patch("app.services.notification_service.send_email_detailed") as mock_email:
    mock_email.return_value = (True, None)

    res_manual = client.post(
        "/challans/manual",
        json={
            "plate_number": "MH12MN5555",
            "violation_code": "NO_HELMET",
            "location": "Swargate, Pune",
        },
        headers=officer_headers,
    )
    assert res_manual.status_code == 200, f"Error: {res_manual.text}"
    man_data = res_manual.json()
    assert man_data["email_status"] == "sent"
    assert man_data["email_sent"] is True
    assert man_data["recipient_email"] == "manoj.patil@example.com"
    print("  [+] PASS: /challans/manual endpoint returned email_status='sent' and email_sent=True.")

# -------------------------------------------------------------
# TEST 8: Auto Owner Lookup When user=None is passed
# -------------------------------------------------------------
print("\n>>> TEST 8: Auto Owner Lookup When user=None")
with patch("app.services.notification_service.send_email_detailed") as mock_email:
    mock_email.return_value = (True, None)

    ch8 = create_challan(
        db=db,
        vehicle=veh_valid,
        violation_type=vt_helmet,
        detection_source=models.DetectionSource.ai,
        location="Airport Road, Pune",
    )
    # Pass user=None explicitly
    res8 = send_challan_notification(db, ch8, user=None)
    assert res8.success is True
    assert res8.recipient == "rajesh.sharma@example.com"
    print("  [+] PASS: send_challan_notification automatically resolved owner from vehicle registry.")

# -------------------------------------------------------------
# TEST 9: AI Violation Detection Endpoint (/violations/detect)
# -------------------------------------------------------------
print("\n>>> TEST 9: AI Violation Detection Endpoint (/violations/detect)")
owner_ai = models.User(
    id=str(uuid.uuid4()),
    full_name="Deepak Joshi",
    email="deepak.joshi@example.com",
    mobile_number="9866666666",
    role=models.UserRole.citizen,
    is_verified=True,
)
db.add(owner_ai)
db.flush()
veh_ai = models.Vehicle(
    id=str(uuid.uuid4()),
    plate_number="MH12AI9999",
    vehicle_type="motorcycle",
    model="Honda Shine",
    owner_id=owner_ai.id,
    registered_mobile=owner_ai.mobile_number,
)
db.add(veh_ai)
db.commit()

mock_ai_detect = schemas.DetectionResult(
    violations_found=["no_helmet"],
    plate_number="MH12AI9999",
    plate_confidence=0.99,
    detected_vehicles=[
        schemas.DetectedVehicle(
            vehicle_id=1,
            vehicle_type="motorcycle",
            plate_number="MH12AI9999",
            plate_confidence=0.99,
            violations_found=["no_helmet"],
        )
    ],
    boxes=[schemas.DetectionBox(class_name="no_helmet", confidence=0.99, bbox=[5, 5, 40, 40])],
)

with patch("app.routers.violations.run_detection", return_value=mock_ai_detect):
    with patch("app.services.notification_service.send_email_detailed") as mock_email:
        mock_email.return_value = (True, None)

        res_ai = client.post(
            "/violations/detect",
            files={"file": ("cctv.jpg", dummy_img, "image/jpeg")},
            headers=officer_headers,
        )

        assert res_ai.status_code == 200, f"Error: {res_ai.text}"
        ai_data = res_ai.json()
        assert len(ai_data["challan_ids"]) == 1
        assert ai_data["email_status"] == "sent"
        assert ai_data["recipient_email"] == "deepak.joshi@example.com"
        assert len(ai_data["email_delivery_results"]) == 1
        print("  [+] PASS: /violations/detect endpoint auto-created challan and recorded email_status='sent'.")

db.close()
print("\n" + "=" * 70)
print("  >>> ALL 9 CHALLAN EMAIL AUDIT & FIX TESTS PASSED SUCCESSFULLY! <<<")
print("=" * 70)
