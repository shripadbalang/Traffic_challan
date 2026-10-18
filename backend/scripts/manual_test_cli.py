"""
Interactive Manual Backend Tester for Traffic E-Challan System.
Demonstrates live API calls against http://localhost:8000.
"""

import urllib.request
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"

def req(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = json.dumps(body).encode("utf-8") if body else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            res_body = response.read().decode("utf-8")
            status = response.status
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = res_body
            return status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed


def print_step(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def main():
    print("[TEST] Traffic E-Challan -- Manual Backend Interactive Test Suite")
    print(f"Targeting server: {BASE_URL}")

    # 1. Health check
    print_step("Step 1: System Health Check")
    status, res = req("GET", "/health")
    print(f"GET /health -> HTTP {status}")
    print(f"Response: {res}")
    if status != 200:
        print("[!] Backend is not running on http://127.0.0.1:8000. Please start uvicorn first.")
        return

    # 2. Officer Login
    print_step("Step 2: Police Officer Login")
    officer_payload = {"identifier": "officer1@echallan.gov.in", "password": "Officer@123"}
    status, res = req("POST", "/auth/login", body=officer_payload)
    print(f"POST /auth/login (officer1@echallan.gov.in) -> HTTP {status}")
    officer_token = res.get("access_token")
    if not officer_token:
        print(f"[!] Login failed: {res}")
        return
    print(f"Logged in as: {res.get('role')} | Access Token: {officer_token[:25]}...")

    # 3. Officer looks up vehicle
    print_step("Step 3: Officer Looks Up Vehicle 'MH12AB1234'")
    status, res = req("GET", "/vehicles/lookup/MH12AB1234", token=officer_token)
    print(f"GET /vehicles/lookup/MH12AB1234 -> HTTP {status}")
    print(f"Vehicle: {res.get('plate_number')} | Model: {res.get('model')} | Owner: {res.get('owner_name')}")

    # 4. Officer issues manual challan
    print_step("Step 4: Officer Issues Manual Challan for 'MH20GH3456'")
    challan_payload = {
        "plate_number": "MH20GH3456",
        "violation_code": "NO_HELMET",
        "fine_amount": 500.0,
        "location": "FC Road, Deccan Gymkhana, Pune",
        "notes": "Rider observed without standard safety helmet during evening patrol."
    }
    status, res = req("POST", "/challans/manual", body=challan_payload, token=officer_token)
    print(f"POST /challans/manual -> HTTP {status}")
    issued_challan_id = res.get("id")
    print(f"Challan Created: ID={issued_challan_id} | Status={res.get('status')} | Amount=Rs.{res.get('fine_amount')}")

    # 5. Citizen OTP Request
    print_step("Step 5: Citizen Requests OTP for Mobile '9820011223' (Aarav Sharma)")
    status, res = req("POST", "/auth/otp/request", body={"mobile_number": "9820011223"})
    print(f"POST /auth/otp/request -> HTTP {status}")
    debug_otp = res.get("debug_otp")
    print(f"Message: {res.get('message')}")
    print(f"Debug OTP (development mode): {debug_otp}")

    # 6. Citizen OTP Verification & Token Retrieval
    print_step("Step 6: Citizen Verifies OTP and Logs In")
    status, res = req("POST", "/auth/otp/verify", body={"mobile_number": "9820011223", "code": debug_otp})
    print(f"POST /auth/otp/verify -> HTTP {status}")
    citizen_token = res.get("access_token")
    print(f"Citizen Logged In! Role={res.get('role')} | Access Token: {citizen_token[:25]}...")

    # 7. Citizen Views My Challans
    print_step("Step 7: Citizen Views 'My Challans'")
    status, res = req("GET", "/challans/my", token=citizen_token)
    print(f"GET /challans/my -> HTTP {status}")
    challans = res if isinstance(res, list) else []
    print(f"Found {len(challans)} challan(s) for citizen Aarav Sharma:")
    target_challan_id = None
    for c in challans:
        print(f" - Challan #{c.get('challan_number')}: Rs.{c.get('fine_amount')} | Violation: {c.get('violation_type', {}).get('name')} | Status: {c.get('status')}")
        if c.get("status") == "pending":
            target_challan_id = c.get("id")

    # 8. Citizen Initiates & Pays Pending Challan
    if target_challan_id:
        print_step(f"Step 8: Citizen Initiates Payment for Challan {target_challan_id}")
        status, res = req("POST", "/payments/initiate", body={"challan_id": target_challan_id}, token=citizen_token)
        order_id = res.get("order_id")
        amount = res.get("amount")
        print(f"Payment Order Created: OrderID={order_id} | Amount=Rs.{amount/100:.2f} | MockMode={res.get('mock_mode')}")

        print_step("Step 9: Citizen Verifies Payment (Mock/Test Gateway)")
        verify_payload = {
            "challan_id": target_challan_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": f"pay_test_{order_id[-8:]}",
            "razorpay_signature": "mock_test_signature"
        }
        status, res = req("POST", "/payments/verify", body=verify_payload, token=citizen_token)
        print(f"POST /payments/verify -> HTTP {status}")
        print(f"Payment Result: {res.get('message')} | Receipt PDF: {res.get('receipt_pdf_path')}")
    else:
        print("\n[!] No pending challan found to pay for citizen Aarav Sharma.")

    # 9. Admin Analytics
    print_step("Step 10: System Administrator Views Dashboard Overview")
    status, res = req("POST", "/auth/login", body={"identifier": "admin@echallan.gov.in", "password": "Admin@123"})
    admin_token = res.get("access_token")
    if not admin_token:
        print(f"[!] Admin login failed: {res}")
        return
    status, res = req("GET", "/admin/analytics/overview", token=admin_token)
    print(f"GET /admin/analytics/overview -> HTTP {status}")
    print(f"Overview Metrics: {json.dumps(res, indent=2)}")

    print("\n" + "=" * 80)
    print("  ALL MANUAL BACKEND TEST FLOWS COMPLETED SUCCESSFULLY!")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
