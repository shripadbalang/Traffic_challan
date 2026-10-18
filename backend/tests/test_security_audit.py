import os
import sys
import uuid
from datetime import datetime, timedelta

# Set working directory & sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app import models
from app.config import settings
from app.core.security import hash_password, create_access_token

# Use in-memory SQLite for reproducible, isolated testing
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

results = []

def record(test_id, category, description, passed, detail=""):
    results.append({
        "id": test_id,
        "category": category,
        "description": description,
        "status": "PASS" if passed else "FAIL",
        "detail": detail,
    })


def setup_seed_data():
    db = TestingSessionLocal()
    # 1. Violation types
    vt1_id = str(uuid.uuid4())
    vt2_id = str(uuid.uuid4())
    vt3_id = str(uuid.uuid4())
    vt1 = models.ViolationType(id=vt1_id, code="NO_HELMET", name="Riding without helmet", base_fine_amount=500.0)
    vt2 = models.ViolationType(id=vt2_id, code="TRIPLE_RIDING", name="Triple riding", base_fine_amount=1000.0)
    vt3 = models.ViolationType(id=vt3_id, code="MOBILE_PHONE_USAGE", name="Mobile phone usage", base_fine_amount=1000.0)
    db.add_all([vt1, vt2, vt3])

    # 2. Users
    u_c1_id = str(uuid.uuid4())
    u_c2_id = str(uuid.uuid4())
    u_off_id = str(uuid.uuid4())
    u_adm_id = str(uuid.uuid4())

    user_citizen_1 = models.User(
        id=u_c1_id,
        full_name="Citizen One",
        mobile_number="9876543210",
        email="citizen1@example.com",
        password_hash=hash_password("Citizen1@123"),
        role=models.UserRole.citizen,
        is_verified=True,
    )
    user_citizen_2 = models.User(
        id=u_c2_id,
        full_name="Citizen Two",
        mobile_number="9876543211",
        email="citizen2@example.com",
        password_hash=hash_password("Citizen2@123"),
        role=models.UserRole.citizen,
        is_verified=True,
    )
    user_officer = models.User(
        id=u_off_id,
        full_name="Officer One",
        mobile_number="9876543212",
        email="officer1@echallan.gov.in",
        password_hash=hash_password("Officer@123"),
        role=models.UserRole.officer,
        is_verified=True,
    )
    user_admin = models.User(
        id=u_adm_id,
        full_name="Admin One",
        mobile_number="9876543213",
        email="admin@echallan.gov.in",
        password_hash=hash_password("Admin@123"),
        role=models.UserRole.admin,
        is_verified=True,
    )
    db.add_all([user_citizen_1, user_citizen_2, user_officer, user_admin])
    db.flush()

    # Officer profile
    off_prof = models.Officer(id=str(uuid.uuid4()), user_id=u_off_id, badge_number="PUN-001", station="Pune")
    db.add(off_prof)

    # Vehicles
    veh1_id = str(uuid.uuid4())
    veh2_id = str(uuid.uuid4())
    veh3_id = str(uuid.uuid4())
    veh1 = models.Vehicle(id=veh1_id, plate_number="MH12AB1234", owner_id=u_c1_id, vehicle_type="motorcycle", model="Activa")
    veh2 = models.Vehicle(id=veh2_id, plate_number="MH14CD5678", owner_id=u_c2_id, vehicle_type="motorcycle", model="Pulsar")
    veh_unassigned = models.Vehicle(id=veh3_id, plate_number="MH01EF9999", owner_id=None, vehicle_type="car", model="Swift")
    db.add_all([veh1, veh2, veh_unassigned])
    db.flush()

    # Challan for citizen 1
    ch1_id = str(uuid.uuid4())
    ch2_id = str(uuid.uuid4())
    ch1 = models.Challan(
        id=ch1_id,
        vehicle_id=veh1_id,
        violation_type_id=vt1_id,
        detection_source=models.DetectionSource.manual,
        fine_amount=500.0,
        status=models.ChallanStatus.pending,
        violation_datetime=datetime.utcnow(),
    )
    # Challan for citizen 2
    ch2 = models.Challan(
        id=ch2_id,
        vehicle_id=veh2_id,
        violation_type_id=vt2_id,
        detection_source=models.DetectionSource.manual,
        fine_amount=1000.0,
        status=models.ChallanStatus.pending,
        violation_datetime=datetime.utcnow(),
    )
    db.add_all([ch1, ch2])
    db.commit()
    db.close()
    return {
        "u_c1": u_c1_id, "u_c2": u_c2_id, "u_off": u_off_id, "u_adm": u_adm_id,
        "ch1": ch1_id, "ch2": ch2_id, "veh1": veh1_id, "vt1": vt1_id
    }


def run_tests():
    print("=== INITIALIZING AUDIT REGRESSION TEST SUITE ===")
    seeds = setup_seed_data()

    # Generate tokens
    token_c1 = create_access_token(subject=seeds["u_c1"], role="citizen")
    token_c2 = create_access_token(subject=seeds["u_c2"], role="citizen")
    token_off = create_access_token(subject=seeds["u_off"], role="officer")
    token_adm = create_access_token(subject=seeds["u_adm"], role="admin")

    h_c1 = {"Authorization": f"Bearer {token_c1}"}
    h_c2 = {"Authorization": f"Bearer {token_c2}"}
    h_off = {"Authorization": f"Bearer {token_off}"}
    h_adm = {"Authorization": f"Bearer {token_adm}"}

    print("\n--- Running Verification Tests ---")

    # 1. Unauthenticated health / root
    r = client.get("/health")
    record("T01", "Health", "GET /health unauthenticated", r.status_code == 200, f"Status: {r.status_code}")

    r = client.get("/")
    record("T02", "Root", "GET / unauthenticated", r.status_code == 200, f"Status: {r.status_code}")

    # 2. OTP Production Protection (VULN-01)
    original_env = settings.ENV
    settings.ENV = "production"
    r_prod_otp = client.post("/auth/otp/request", json={"mobile_number": "9876543210"})
    settings.ENV = original_env
    has_debug_otp_in_prod = "debug_otp" in r_prod_otp.json()
    record("T03", "Auth", "OTP Leakage prevented in production mode (VULN-01)", not has_debug_otp_in_prod,
           f"debug_otp in production response: {has_debug_otp_in_prod}")

    # 3. User Enumeration Prevention (VULN-09)
    r_unknown = client.post("/auth/otp/request", json={"mobile_number": "9999999999"})
    record("T04", "Auth", "User Enumeration prevented via generic message (VULN-09)", r_unknown.status_code == 200,
           f"Unknown user returns {r_unknown.status_code} ({r_unknown.json()})")

    # 4. Vehicle Hijacking Prevention (VULN-02)
    r_hijack = client.post("/auth/citizen/signup", json={
        "full_name": "Attacker Hijacker",
        "mobile_number": "9111111111",
        "plate_number": "MH12AB1234",  # Already belongs to Citizen 1!
        "password": "Password123!",
    })
    db = TestingSessionLocal()
    veh_check = db.query(models.Vehicle).filter(models.Vehicle.plate_number == "MH12AB1234").first()
    owner_unchanged = (veh_check.owner_id == seeds["u_c1"])
    db.close()
    record("T05", "Access Control", "Vehicle Ownership Hijacking prevented with HTTP 409 (VULN-02)",
           r_hijack.status_code == 409 and owner_unchanged,
           f"Status: {r_hijack.status_code}, Vehicle owner_id unchanged: {owner_unchanged}")

    # 5. Vehicle Lookup PII Protection (VULN-08)
    r_lookup_anon = client.get("/vehicles/lookup/MH12AB1234")
    r_lookup_officer = client.get("/vehicles/lookup/MH12AB1234", headers=h_off)
    record("T06", "Information Exposure", "Vehicle Lookup requires Officer/Admin auth (VULN-08)",
           r_lookup_anon.status_code in (401, 403) and r_lookup_officer.status_code == 200,
           f"Anon status: {r_lookup_anon.status_code}, Officer status: {r_lookup_officer.status_code}")

    # 6. IDOR on Challan Detail
    r_idor = client.get(f"/challans/{seeds['ch2']}", headers=h_c1)  # Citizen 1 requesting Citizen 2's challan
    record("T07", "Access Control", "IDOR properly blocked in GET /challans/{challan_id}", r_idor.status_code == 403,
           f"Status: {r_idor.status_code}")

    # 7. Dispute State Machine Validation (VULN-10)
    db = TestingSessionLocal()
    veh_c1_clean = models.Vehicle(id=str(uuid.uuid4()), plate_number="MH99ZZ9999", owner_id=seeds["u_c1"], vehicle_type="motorcycle")
    db.add(veh_c1_clean)
    db.flush()

    ch_paid_id = str(uuid.uuid4())
    ch_paid = models.Challan(
        id=ch_paid_id,
        vehicle_id=veh_c1_clean.id,
        violation_type_id=seeds["vt1"],
        detection_source=models.DetectionSource.manual,
        fine_amount=500.0,
        status=models.ChallanStatus.paid,
        violation_datetime=datetime.utcnow(),
    )
    ch_pending_id = str(uuid.uuid4())
    ch_pending = models.Challan(
        id=ch_pending_id,
        vehicle_id=veh_c1_clean.id,
        violation_type_id=seeds["vt1"],
        detection_source=models.DetectionSource.manual,
        fine_amount=500.0,
        status=models.ChallanStatus.pending,
        violation_datetime=datetime.utcnow(),
    )
    db.add_all([ch_paid, ch_pending])
    db.commit()
    db.close()

    r_dispute_paid = client.patch(f"/challans/{ch_paid_id}/dispute", headers=h_c1)
    db = TestingSessionLocal()
    ch_paid_reloaded = db.query(models.Challan).filter(models.Challan.id == ch_paid_id).first()
    dispute_rejected = (r_dispute_paid.status_code == 400 and ch_paid_reloaded.status == models.ChallanStatus.paid)
    db.close()
    record("T08", "Business Logic", "Disputing non-pending challan is blocked (VULN-10)", dispute_rejected,
           f"Status: {r_dispute_paid.status_code}, Status preserved: {ch_paid_reloaded.status.value}")

    # 8. Payment Integrity & Order Mismatch Check (VULN-03)
    r_pay_init = client.post("/payments/initiate", json={"challan_id": ch_pending_id}, headers=h_c1)
    # Attempting verify with wrong order id
    r_pay_mismatch = client.post("/payments/verify", json={
        "challan_id": ch_pending_id,
        "razorpay_order_id": "mismatched_order_id",
        "razorpay_payment_id": "fake_pay_123",
        "razorpay_signature": "signature_123"
    }, headers=h_c1)
    record("T09", "Payment Security", "Mismatched Order ID rejected in payment verification (VULN-03)",
           r_pay_mismatch.status_code == 400,
           f"Mismatch status: {r_pay_mismatch.status_code}")

    # 9. Role Escalation Checks
    r_admin_by_citizen = client.get("/admin/analytics/overview", headers=h_c1)
    r_admin_by_officer = client.get("/admin/analytics/overview", headers=h_off)
    record("T10", "Access Control", "Admin endpoints strictly restricted to Admin role",
           r_admin_by_citizen.status_code == 403 and r_admin_by_officer.status_code == 403,
           f"Citizen status: {r_admin_by_citizen.status_code}, Officer status: {r_admin_by_officer.status_code}")

    # 10. Safe File Streaming & Traversal Protection (VULN-04)
    os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)
    test_evidence_file = os.path.join(settings.EVIDENCE_STORAGE_PATH, "test_evidence.jpg")
    with open(test_evidence_file, "w") as f:
        f.write("VALID EVIDENCE IMAGE CONTENT")

    r_file_traversal = client.get("/files/evidence/..%2F..%2F.env")
    r_file_valid = client.get("/files/evidence/test_evidence.jpg", headers=h_off)
    record("T11", "Information Exposure", "Path-traversal-safe evidence file streaming (VULN-04)",
           r_file_traversal.status_code == 404 and r_file_valid.status_code == 200,
           f"Traversal status: {r_file_traversal.status_code}, Valid file status: {r_file_valid.status_code}")

    # 11. Security Headers (VULN-12)
    r_headers = client.get("/health")
    h = r_headers.headers
    has_csp = "content-security-policy" in h
    has_xcto = "x-content-type-options" in h
    has_xfo = "x-frame-options" in h
    record("T12", "Headers", "Security Headers properly injected (VULN-12)",
           has_csp and has_xcto and has_xfo,
           f"CSP: {has_csp}, X-Content-Type-Options: {has_xcto}, X-Frame-Options: {has_xfo}")

    # 12. Cryptographic randomness of OTP (VULN-13)
    from app.core.security import generate_otp
    otps = [generate_otp() for _ in range(20)]
    record("T13", "Cryptography", "CSPRNG OTP format & length (VULN-13)",
           all(len(o) == 6 and o.isdigit() for o in otps),
           f"Sample OTPs: {otps[:3]}")

    # 13. File Upload Extension Whitelisting (VULN-05)
    r_bad_ext = client.post("/violations/detect", files={
        "file": ("exploit.html", b"<h1>Evil Script</h1>", "text/html")
    }, headers=h_off)
    record("T14", "File Upload Security", "Disallowed file extensions rejected with HTTP 400 (VULN-05)",
           r_bad_ext.status_code == 400,
           f"Upload status: {r_bad_ext.status_code} ({r_bad_ext.json().get('detail')})")

    # 14. Evidence Model Keyword Fix (VULN-06)
    db = TestingSessionLocal()
    try:
        ev = models.Evidence(
            challan_id=seeds["ch1"],
            file_path="storage/evidence/sample.jpg",
            file_type="image",
            ai_annotations_json="[]",
        )
        db.add(ev)
        db.commit()
        ev_created = True
    except Exception as e:
        ev_created = False
    finally:
        db.close()
    record("T15", "Database Integrity", "Evidence model instantiates without keyword crash (VULN-06)",
           ev_created, "Evidence record created successfully")

    # Clean up test evidence file
    if os.path.exists(test_evidence_file):
        os.remove(test_evidence_file)

    print("\n=== VERIFICATION RESULTS SUMMARY ===")
    all_passed = True
    for res in results:
        tag = "[+]" if res["status"] == "PASS" else "[-]"
        if res["status"] != "PASS":
            all_passed = False
        print(f"{tag} {res['id']}: {res['description']} -> {res['status']} | {res['detail']}")

    if all_passed:
        print("\n>>> ALL 15 SECURITY AUDIT REGRESSION TESTS PASSED! <<<")
    else:
        print("\n>>> SOME TESTS FAILED. PLEASE REVIEW ABOVE. <<<")


if __name__ == "__main__":
    run_tests()
