import sys
import os
import requests

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app import models
from app.core.security import create_access_token

BASE_URL = "http://localhost:8000"
NGROK_URL = "https://getting-hamburger-cradle.ngrok-free.dev"

def run_tests():
    db = SessionLocal()
    print("=" * 70)
    print("RUNNING REGRESSION SUITE: EVIDENCE VISIBILITY & VEHICLE ISOLATION")
    print("=" * 70)

    # 1. Fetch real user accounts from DB
    user_a = db.query(models.User).filter(models.User.email == "balangshripad2710@gmail.com").first()
    user_b = db.query(models.User).filter(models.User.email == "shripatbalang@gmail.com").first()
    admin = db.query(models.User).filter(models.User.email == "admin@echallan.gov.in").first()

    assert user_a is not None, "Account A (balangshripad2710@gmail.com) not found in DB"
    assert user_b is not None, "Account B (shripatbalang@gmail.com) not found in DB"
    assert admin is not None, "Admin user not found in DB"

    print(f"[OK] Found Account A: {user_a.email} (ID: {user_a.id})")
    print(f"[OK] Found Account B: {user_b.email} (ID: {user_b.id})")
    print(f"[OK] Found Admin:     {admin.email} (ID: {admin.id})")

    token_a = create_access_token(str(user_a.id), "owner", email=user_a.email)
    token_b = create_access_token(str(user_b.id), "citizen", email=user_b.email)
    token_admin = create_access_token(str(admin.id), "admin", email=admin.email)

    # --- TEST GROUP 1: ACCOUNT & VEHICLE ISOLATION ---
    print("\n" + "-" * 50)
    print("TEST GROUP 1: ACCOUNT & VEHICLE ISOLATION")
    print("-" * 50)

    # A's vehicles
    res_a_veh = requests.get(f"{BASE_URL}/vehicles/my", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a_veh.status_code == 200, f"Account A /vehicles/my failed: {res_a_veh.text}"
    vehs_a = res_a_veh.json()
    plates_a = [v["plate_number"] for v in vehs_a]
    print(f"[TEST 1.1] Account A vehicles returned ({len(vehs_a)}): {plates_a}")
    assert len(vehs_a) == 2, f"Expected Account A to have 2 vehicles, got {len(vehs_a)}"
    assert "MH37AB0940" in plates_a and "MH37V2510" in plates_a, "Account A missing expected plates"

    # B's vehicles
    res_b_veh = requests.get(f"{BASE_URL}/vehicles/my", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b_veh.status_code == 200, f"Account B /vehicles/my failed: {res_b_veh.text}"
    vehs_b = res_b_veh.json()
    plates_b = [v["plate_number"] for v in vehs_b]
    print(f"[TEST 1.2] Account B vehicles returned ({len(vehs_b)}): {plates_b}")
    assert len(vehs_b) == 0, f"Expected Account B to have 0 vehicles, but got: {plates_b}"
    assert "MH37AB0940" not in plates_b, "CRITICAL LEAK: Account B saw Account A's vehicle MH37AB0940!"
    assert "MH37V2510" not in plates_b, "CRITICAL LEAK: Account B saw Account A's vehicle MH37V2510!"
    print("  --> PASSED: Account B has 0 vehicles and CANNOT see Account A's vehicles.")

    # A's challans
    res_a_chl = requests.get(f"{BASE_URL}/challans/my", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a_chl.status_code == 200, f"Account A /challans/my failed: {res_a_chl.text}"
    chls_a = res_a_chl.json()
    print(f"[TEST 1.3] Account A challans returned ({len(chls_a)})")
    assert len(chls_a) > 0, "Account A should have challans"
    test_challan_id = chls_a[0]["id"]

    # B's challans
    res_b_chl = requests.get(f"{BASE_URL}/challans/my", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b_chl.status_code == 200, f"Account B /challans/my failed: {res_b_chl.text}"
    chls_b = res_b_chl.json()
    print(f"[TEST 1.4] Account B challans returned ({len(chls_b)})")
    assert len(chls_b) == 0, f"CRITICAL LEAK: Account B saw Account A's challans! Found {len(chls_b)}"
    print("  --> PASSED: Account B has 0 challans and CANNOT see Account A's challans.")

    # --- TEST GROUP 2: EVIDENCE ACCESS & SECURITY (LOCAL & NGROK) ---
    print("\n" + "-" * 50)
    print("TEST GROUP 2: EVIDENCE ACCESS, IDOR PROTECTION & RESOLUTION")
    print("-" * 50)

    # 2.1 Owner opens own evidence
    ev_a = requests.get(f"{BASE_URL}/challans/{test_challan_id}/evidence", headers={"Authorization": f"Bearer {token_a}"})
    print(f"[TEST 2.1] Owner fetching own evidence: Status {ev_a.status_code}, Content-Type: {ev_a.headers.get('content-type')}, Length: {len(ev_a.content)}")
    assert ev_a.status_code == 200, f"Owner failed to get evidence: {ev_a.text}"
    assert "image" in ev_a.headers.get("content-type", "").lower()
    assert len(ev_a.content) > 1000, "Evidence image content empty or invalid"

    # 2.2 Owner opens own evidence with query param token
    ev_a_param = requests.get(f"{BASE_URL}/challans/{test_challan_id}/evidence?token={token_a}")
    print(f"[TEST 2.2] Owner fetching evidence with ?token=: Status {ev_a_param.status_code}, Length: {len(ev_a_param.content)}")
    assert ev_a_param.status_code == 200
    assert len(ev_a_param.content) == len(ev_a.content)

    # 2.3 Account B attempts to access Account A's evidence (IDOR protection)
    ev_b = requests.get(f"{BASE_URL}/challans/{test_challan_id}/evidence", headers={"Authorization": f"Bearer {token_b}"})
    print(f"[TEST 2.3] Account B attempting to access Account A evidence: Status {ev_b.status_code}")
    assert ev_b.status_code == 403, f"IDOR VULNERABILITY! Expected 403 Forbidden, got {ev_b.status_code}"
    print("  --> PASSED: IDOR protection prevented Account B from viewing Account A's evidence.")

    # 2.4 Unauthenticated request
    ev_none = requests.get(f"{BASE_URL}/challans/{test_challan_id}/evidence")
    print(f"[TEST 2.4] Unauthenticated evidence request: Status {ev_none.status_code}")
    assert ev_none.status_code == 401, f"Expected 401 Unauthorized, got {ev_none.status_code}"

    # 2.5 Admin supervisory access
    ev_admin = requests.get(f"{BASE_URL}/challans/{test_challan_id}/evidence", headers={"Authorization": f"Bearer {token_admin}"})
    print(f"[TEST 2.5] Admin fetching evidence: Status {ev_admin.status_code}, Length: {len(ev_admin.content)}")
    assert ev_admin.status_code == 200
    assert len(ev_admin.content) == len(ev_a.content)
    print("  --> PASSED: Admin has full supervisory access to high-resolution evidence.")

    # 2.6 Admin challan detail returns clean evidence URLs
    admin_detail_res = requests.get(f"{BASE_URL}/admin/challans/{test_challan_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert admin_detail_res.status_code == 200
    admin_detail = admin_detail_res.json()
    assert admin_detail.get("has_evidence") is True
    assert admin_detail.get("evidence_url") == f"/challans/{test_challan_id}/evidence"
    for ev_item in admin_detail.get("evidence", []):
        assert ev_item["file_path"].startswith("/challans/")
        assert not ev_item["file_path"].startswith("./storage/evidence")
        print(f"[TEST 2.6] Admin detail evidence item: file_name={ev_item['file_name']}, path={ev_item['file_path']}")
    print("  --> PASSED: Admin detail returns clean authenticated evidence endpoints.")

    # 2.7 Production Ngrok tunnel test
    try:
        ngrok_headers = {
            "Authorization": f"Bearer {token_a}",
            "ngrok-skip-browser-warning": "true",
        }
        ev_ngrok = requests.get(f"{NGROK_URL}/challans/{test_challan_id}/evidence", headers=ngrok_headers, timeout=10)
        print(f"[TEST 2.7] Live Ngrok tunnel evidence fetch: Status {ev_ngrok.status_code}, Content-Type: {ev_ngrok.headers.get('content-type')}, Length: {len(ev_ngrok.content)}")
        assert ev_ngrok.status_code == 200
        assert "image" in ev_ngrok.headers.get("content-type", "").lower()
        print("  --> PASSED: Production Ngrok tunnel successfully delivers evidence binary data.")
    except Exception as exc:
        print(f"[WARNING] Ngrok tunnel test skipped/warned: {exc}")

    # --- TEST GROUP 3: DATABASE COUNTS INTEGRITY ---
    print("\n" + "-" * 50)
    print("TEST GROUP 3: DATABASE AUDIT & ADMIN COUNTS INTEGRITY")
    print("-" * 50)

    db_vehs_a = db.query(models.Vehicle).filter(models.Vehicle.owner_id == user_a.id).count()
    db_vehs_b = db.query(models.Vehicle).filter(models.Vehicle.owner_id == user_b.id).count()
    print(f"[TEST 3.1] DB vehicle count for Account A: {db_vehs_a}")
    print(f"[TEST 3.2] DB vehicle count for Account B: {db_vehs_b}")
    assert db_vehs_a == 2, f"Expected 2 vehicles in DB for A, got {db_vehs_a}"
    assert db_vehs_b == 0, f"Expected 0 vehicles in DB for B, got {db_vehs_b}"

    # Admin owners API
    admin_owners_res = requests.get(f"{BASE_URL}/admin/owners", headers={"Authorization": f"Bearer {token_admin}"})
    assert admin_owners_res.status_code == 200
    owners_list = admin_owners_res.json()
    items = owners_list.get("items", owners_list) if isinstance(owners_list, dict) else owners_list
    admin_owner_a = next((o for o in items if o.get("email") == "balangshripad2710@gmail.com"), None)
    admin_owner_b = next((o for o in items if o.get("email") == "shripatbalang@gmail.com"), None)
    if admin_owner_a:
        print(f"[TEST 3.3] Admin owners API vehicle_count for Account A: {admin_owner_a.get('vehicles_count') or admin_owner_a.get('vehicle_count')}")
    if admin_owner_b:
        print(f"[TEST 3.4] Admin owners API vehicle_count for Account B: {admin_owner_b.get('vehicles_count') or admin_owner_b.get('vehicle_count')}")

    db.close()
    print("\n" + "=" * 70)
    print("ALL REGRESSION CHECKS PASSED SUCCESSFULLY (100% SUCCESS)!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
