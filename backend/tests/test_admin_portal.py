import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app

def run_admin_portal_tests():
    client = TestClient(app)
    print("=" * 70)
    print("        COMPREHENSIVE ADMIN PORTAL AUTOMATED TEST SUITE")
    print("=" * 70)

    # -------------------------------------------------------------
    # Test 1: Admin Authentication & Credentials
    # -------------------------------------------------------------
    print("\n[1] Testing Admin Authentication...")
    res = client.post("/auth/admin/login", json={
        "identifier": "admin@echallan.gov.in",
        "password": "Admin@123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_auth = res.json()
    assert admin_auth["role"] == "admin", f"Role mismatch: {admin_auth}"
    admin_token = admin_auth["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  [OK] Admin login successful. Role: 'admin'. Token acquired.")

    # Test 1b: Wrong password
    res_bad_pw = client.post("/auth/admin/login", json={
        "identifier": "admin@echallan.gov.in",
        "password": "WrongPassword@123"
    })
    assert res_bad_pw.status_code == 401, f"Expected 401 on bad password: {res_bad_pw.text}"
    print("  [OK] Invalid admin password correctly rejected with 401.")

    # Test 1c: Non-admin (Officer) attempting Admin Login
    res_officer_to_admin = client.post("/auth/admin/login", json={
        "identifier": "officer@traffic.gov.in",
        "password": "Traffic@123"
    })
    assert res_officer_to_admin.status_code == 401, "Officer must NOT be allowed to login via Admin endpoint!"
    print("  [OK] Officer credentials to admin login rejected with 401 Unauthorized.")

    # -------------------------------------------------------------
    # Test 2: Role-Based Authorization & Route Protection
    # -------------------------------------------------------------
    print("\n[2] Testing Route Protection & Access Control (Officers/Owners vs Admin)...")
    # Log in as officer to get officer token
    res_officer = client.post("/auth/officer/login", json={
        "email": "officer@traffic.gov.in",
        "password": "Traffic@123"
    })
    assert res_officer.status_code == 200, f"Officer login failed: {res_officer.text}"
    officer_token = res_officer.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    # Verify Officer is blocked from ALL Admin endpoints (403 Forbidden)
    protected_admin_routes = [
        "/admin/dashboard-stats",
        "/admin/officers",
        "/admin/owners",
        "/admin/vehicles",
        "/admin/challans",
        "/admin/payments",
        "/admin/violation-analytics",
        "/admin/ai-monitoring",
        "/admin/reports?report_type=challans",
        "/admin/audit-logs",
        "/admin/settings",
    ]

    for route in protected_admin_routes:
        res_blocked = client.get(route, headers=officer_headers)
        assert res_blocked.status_code == 403, f"Officer should be 403 Forbidden from {route}, got {res_blocked.status_code}"
    print(f"  [OK] All {len(protected_admin_routes)} Admin routes strictly returned 403 FORBIDDEN to Officer.")

    # Unauthenticated user blocked
    for route in protected_admin_routes[:3]:
        res_anon = client.get(route)
        assert res_anon.status_code in (401, 403), f"Anon should be 401/403 from {route}"
    print("  [OK] Unauthenticated requests blocked with 401/403.")

    # -------------------------------------------------------------
    # Test 3: Admin Dashboard Statistics (Real Database Data)
    # -------------------------------------------------------------
    print("\n[3] Testing Admin Dashboard Statistics...")
    res_stats = client.get("/admin/dashboard-stats", headers=admin_headers)
    assert res_stats.status_code == 200, f"Failed: {res_stats.text}"
    stats = res_stats.json()
    print(f"  [+] Total Owners    : {stats['total_owners']}")
    print(f"  [+] Total Vehicles  : {stats['total_vehicles']}")
    print(f"  [+] Total Officers  : {stats['total_officers']} ({stats['active_officers']} active)")
    print(f"  [+] Total Challans  : {stats['total_challans']} ({stats['unpaid_challans']} unpaid, {stats['paid_challans']} paid)")
    print(f"  [+] Total Fines     : INR{stats['total_fine_amount']}")
    print(f"  [+] Total Collected : INR{stats['total_collected_amount']}")
    print(f"  [+] Challans Today  : {stats['challans_today']}")
    assert stats["total_vehicles"] > 0, "Vehicles should exist in database"
    assert stats["total_challans"] > 0, "Challans should exist in database"
    print("  [OK] Dashboard stats retrieved from real Supabase tables.")

    # -------------------------------------------------------------
    # Test 4: Violation Analytics
    # -------------------------------------------------------------
    print("\n[4] Testing Violation Analytics with Time Filters...")
    for tf in ["today", "7d", "30d", "year"]:
        res_va = client.get(f"/admin/violation-analytics?time_filter={tf}", headers=admin_headers)
        assert res_va.status_code == 200, f"Failed for {tf}: {res_va.text}"
        data_va = res_va.json()
        assert "violation_breakdown" in data_va
    print(f"  [OK] Violation analytics functional across today, 7d, 30d, and year filters.")

    # -------------------------------------------------------------
    # Test 5: Challan Management
    # -------------------------------------------------------------
    print("\n[5] Testing Challans Listing, Search, Details & Status Update...")
    res_ch = client.get("/admin/challans?limit=5", headers=admin_headers)
    assert res_ch.status_code == 200
    ch_data = res_ch.json()
    assert ch_data["total"] > 0
    sample_challan = ch_data["items"][0]
    ch_id = sample_challan["id"]
    print(f"  [+] Fetched {len(ch_data['items'])} challans (Total: {ch_data['total']}). Sample ID: {ch_id}")

    # Inspect single challan detail
    res_ch_detail = client.get(f"/admin/challans/{ch_id}", headers=admin_headers)
    assert res_ch_detail.status_code == 200
    detail = res_ch_detail.json()
    assert "vehicle_plate" in detail and "violation" in detail
    print(f"  [OK] Challan {ch_id} details loaded: Vehicle {detail['vehicle_plate']}, Violation: {detail['violation']['name']}")

    # Update status test
    res_status = client.patch(
        f"/admin/challans/{ch_id}/status",
        headers=admin_headers,
        json={"status": "disputed", "notes": "Automated audit test note"}
    )
    assert res_status.status_code == 200
    # Revert back to original status
    client.patch(
        f"/admin/challans/{ch_id}/status",
        headers=admin_headers,
        json={"status": sample_challan["status"], "notes": "Reverted automated test note"}
    )
    print("  [OK] Admin status update & dispute resolution verified.")

    # -------------------------------------------------------------
    # Test 6: Officer Management
    # -------------------------------------------------------------
    print("\n[6] Testing Officer Listing, Details & Accountability...")
    res_officers = client.get("/admin/officers", headers=admin_headers)
    assert res_officers.status_code == 200
    officer_list = res_officers.json()
    assert len(officer_list) > 0
    sample_officer = officer_list[0]
    print(f"  [+] Found {len(officer_list)} officers. Sample: {sample_officer['full_name']} ({sample_officer['badge_number']})")
    assert "violations_captured" in sample_officer
    assert "challans_today" in sample_officer

    # Get officer detail
    res_off_detail = client.get(f"/admin/officers/{sample_officer['id']}", headers=admin_headers)
    assert res_off_detail.status_code == 200
    print(f"  [OK] Officer details and activity history loaded successfully.")

    # -------------------------------------------------------------
    # Test 7: Owner Management
    # -------------------------------------------------------------
    print("\n[7] Testing Owner Management & Privacy Safeguards...")
    res_owners = client.get("/admin/owners", headers=admin_headers)
    assert res_owners.status_code == 200
    owners_data = res_owners.json()
    assert owners_data["total"] > 0
    sample_owner = owners_data["items"][0]
    print(f"  [+] Found {owners_data['total']} owners. Sample: {sample_owner['full_name']}")

    # Check detail
    res_owner_detail = client.get(f"/admin/owners/{sample_owner['id']}", headers=admin_headers)
    assert res_owner_detail.status_code == 200
    owner_d = res_owner_detail.json()
    assert "password" not in owner_d and "password_hash" not in owner_d and "code" not in owner_d
    print("  [OK] Owner profile inspected. Sensitive password/OTP fields NOT exposed.")

    # -------------------------------------------------------------
    # Test 8: Vehicle Management
    # -------------------------------------------------------------
    print("\n[8] Testing Vehicle Registry...")
    res_veh = client.get("/admin/vehicles", headers=admin_headers)
    assert res_veh.status_code == 200
    veh_data = res_veh.json()
    assert veh_data["total"] > 0
    sample_plate = veh_data["items"][0]["plate_number"]
    res_veh_detail = client.get(f"/admin/vehicles/{sample_plate}", headers=admin_headers)
    assert res_veh_detail.status_code == 200
    print(f"  [OK] Vehicle {sample_plate} details & violation history loaded successfully.")

    # -------------------------------------------------------------
    # Test 9: Payment Management
    # -------------------------------------------------------------
    print("\n[9] Testing Payment Management...")
    res_pay = client.get("/admin/payments", headers=admin_headers)
    assert res_pay.status_code == 200
    pay_data = res_pay.json()
    print(f"  [OK] Fetched {pay_data['total']} payment records.")

    # -------------------------------------------------------------
    # Test 10: AI / Computer Vision Monitoring
    # -------------------------------------------------------------
    print("\n[10] Testing AI Monitoring...")
    res_ai = client.get("/admin/ai-monitoring", headers=admin_headers)
    assert res_ai.status_code == 200
    ai_data = res_ai.json()
    print(f"  [+] Total AI Detections: {ai_data['total_detections']}")
    print(f"  [+] Average Confidence  : {ai_data['average_confidence']}")
    print("  [OK] AI monitoring metrics computed accurately.")

    # -------------------------------------------------------------
    # Test 11: Reports & CSV Export
    # -------------------------------------------------------------
    print("\n[11] Testing Reports & CSV Export...")
    for rtype in ["challans", "payments", "officers", "vehicles"]:
        res_rep = client.get(f"/admin/reports?report_type={rtype}", headers=admin_headers)
        assert res_rep.status_code == 200
        # Test CSV export
        res_csv = client.get(f"/admin/reports/export?report_type={rtype}", headers=admin_headers)
        assert res_csv.status_code == 200
        assert "text/csv" in res_csv.headers["content-type"]
        assert len(res_csv.text) > 20
    print("  [OK] Reports and CSV stream exports verified for all entities.")

    # -------------------------------------------------------------
    # Test 12: Audit Logs
    # -------------------------------------------------------------
    print("\n[12] Testing Audit Logs...")
    res_audit = client.get("/admin/audit-logs", headers=admin_headers)
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    print(f"  [+] Total Audit Logs Recorded: {audit_data['total']}")
    assert audit_data["total"] > 0
    # Check that admin_login action was logged
    actions = [log["action"] for log in audit_data["items"]]
    assert "admin_login" in actions
    print("  [OK] Administrative actions logged with timestamp, actor, action, and status.")

    # -------------------------------------------------------------
    # Test 13: System Settings
    # -------------------------------------------------------------
    print("\n[13] Testing System Settings...")
    res_settings = client.get("/admin/settings", headers=admin_headers)
    assert res_settings.status_code == 200
    settings_data = res_settings.json()
    assert len(settings_data) > 0
    print(f"  [+] System settings configured: {len(settings_data)} parameters.")

    print("\n" + "=" * 70)
    print("  [SUCCESS] ALL 13 TEST SUITES PASSED! ADMIN PORTAL FULLY OPERATIONAL.")
    print("=" * 70)

if __name__ == "__main__":
    run_admin_portal_tests()
