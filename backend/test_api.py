import requests

BASE_URL = "http://127.0.0.1:8000"

print("=" * 50)
print("1. Health check")
print("=" * 50)
r = requests.get(f"{BASE_URL}/health", timeout=15)
print(r.status_code, r.json())

print("\n" + "=" * 50)
print("2. Request OTP for citizen")
print("=" * 50)
r = requests.post(f"{BASE_URL}/auth/otp/request", json={"mobile_number": "9123456780"}, timeout=15)
print("Status code:", r.status_code)
print("Raw response text:", repr(r.text))

if r.status_code != 200:
    print("\nSTOPPING - OTP request failed.")
    exit()

otp_code = r.json().get("debug_otp")
print(f"\nGot OTP: {otp_code}")

print("\n" + "=" * 50)
print("3. Verify OTP")
print("=" * 50)
r = requests.post(f"{BASE_URL}/auth/otp/verify", json={"mobile_number": "9123456780", "code": otp_code}, timeout=15)
print("Status code:", r.status_code)
print("Raw response text:", repr(r.text))

if r.status_code != 200:
    print("\nSTOPPING - OTP verify failed.")
    exit()

citizen_token = r.json().get("access_token")
print(f"\nGot citizen token (first 30 chars): {citizen_token[:30]}...")

print("\n" + "=" * 50)
print("4. Get citizen's challans")
print("=" * 50)
headers = {"Authorization": f"Bearer {citizen_token}"}
r = requests.get(f"{BASE_URL}/challans/my", headers=headers, timeout=15)
print(r.status_code)
print(r.json())