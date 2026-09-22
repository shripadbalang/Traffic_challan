import requests

BASE_URL = "http://127.0.0.1:8000"

def step(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)

# 1. Citizen signup
step("1. Citizen signup")
r = requests.post(f"{BASE_URL}/auth/citizen/signup", json={
    "full_name": "Priya Deshmukh",
    "mobile_number": "9876500001",
    "plate_number": "MH14CD5678",
    "email": "priya.deshmukh@example.com",
    "password": "Citizen@123"
}, timeout=15)
print(r.status_code, r.text)

# 2. Request OTP
step("2. Request OTP")
r = requests.post(f"{BASE_URL}/auth/otp/request", json={"mobile_number": "9876500001"}, timeout=15)
print(r.status_code, r.text)
otp_code = r.json().get("debug_otp")
print("OTP:", otp_code)

# 3. Verify OTP -> citizen token
step("3. Verify OTP")
r = requests.post(f"{BASE_URL}/auth/otp/verify", json={"mobile_number": "9876500001", "code": otp_code}, timeout=15)
print(r.status_code, r.text)
citizen_token = r.json().get("access_token")

# 4. Officer login
step("4. Officer login")
r = requests.post(f"{BASE_URL}/auth/login", json={
    "identifier": "officer1@echallan.gov.in",
    "password": "Officer@123"
}, timeout=15)
print(r.status_code, r.text)
officer_token = r.json().get("access_token")

# 5. Officer issues manual challan
step("5. Officer issues challan")
headers_officer = {"Authorization": f"Bearer {officer_token}"}
r = requests.post(f"{BASE_URL}/challans/manual", json={
    "plate_number": "MH14CD5678",
    "violation_code": "MOBILE_PHONE_USAGE",
    "location": "JM Road, Pune",
    "notes": "Driver seen using phone at signal"
}, headers=headers_officer, timeout=15)
print(r.status_code, r.text)
challan_id = r.json().get("id")
print("Challan ID:", challan_id)

# 6. Citizen fetches their challans
step("6. Citizen's challans")
headers_citizen = {"Authorization": f"Bearer {citizen_token}"}
r = requests.get(f"{BASE_URL}/challans/my", headers=headers_citizen, timeout=15)
print(r.status_code, r.text)

# 7. Citizen initiates payment
step("7. Initiate payment")
r = requests.post(f"{BASE_URL}/payments/initiate", json={"challan_id": challan_id}, headers=headers_citizen, timeout=15)
print(r.status_code, r.text)
order_id = r.json().get("order_id")
mock_mode = r.json().get("mock_mode")
print("Order ID:", order_id, "| Mock mode:", mock_mode)

# 8. Citizen verifies payment (mock values since we're in mock mode / test mode)
step("8. Verify payment")
r = requests.post(f"{BASE_URL}/payments/verify", json={
    "challan_id": challan_id,
    "razorpay_order_id": order_id,
    "razorpay_payment_id": "pay_test_mock123",
    "razorpay_signature": "mock_signature"
}, headers=headers_citizen, timeout=15)
print(r.status_code, r.text)

# 9. Confirm challan status updated
step("9. Confirm challan is now PAID")
r = requests.get(f"{BASE_URL}/challans/{challan_id}", headers=headers_citizen, timeout=15)
print(r.status_code, r.text)