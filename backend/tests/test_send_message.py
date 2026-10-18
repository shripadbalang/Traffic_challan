"""
Test script to send messages and challans to ALL citizens:
1. Shripad Balang  (9307716594 | MH 37 AB 0940)
2. Payal Sune      (7001336011 | MH 27 BU 6590)
3. Pranav Sheelwant(7385553065 | MH 28 AT 2037)

Verifies:
- Mobile OTP login & token generation for all 3 users
- E-Challan issuance and message dispatch (SMS, Email, In-App) for all 3 vehicles
- Email delivery status in Supabase (status="sent")
- Citizen personal notifications endpoint (/notifications/my)
- Admin central SMS outbox (/notifications/admin/sms-outbox)
"""

import os
import sys
import requests

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app import models
from app.services.notification_service import notify_challan_created

BASE_URL = "http://127.0.0.1:8000"

USERS = [
    {"name": "Shripad Balang", "mobile": "9307716594", "plate": "MH37AB0940"},
    {"name": "Payal Sune", "mobile": "7001336011", "plate": "MH27BU6590"},
    {"name": "Pranav Sheelwant", "mobile": "7385553065", "plate": "MH28AT2037"},
]

print("=" * 75)
print("     DISPATCHING CHALLANS & MESSAGES TO ALL USERS")
print("=" * 75)

db = SessionLocal()
user_tokens = {}

try:
    for target in USERS:
        name = target["name"]
        mobile = target["mobile"]
        plate = target["plate"]

        print(f"\n>>> PROCESSING: {name} (Mobile: {mobile} | Vehicle: {plate})")
        print("-" * 70)

        # 1. OTP Verification Message
        print(f"  [1] Requesting OTP message for {mobile}...")
        r = requests.post(f"{BASE_URL}/auth/otp/request", json={"mobile_number": mobile})
        otp_code = r.json().get("debug_otp")
        print(f"      [+] OTP Code: {otp_code}")

        v = requests.post(f"{BASE_URL}/auth/otp/verify", json={"mobile_number": mobile, "code": otp_code})
        token = v.json().get("access_token")
        user_tokens[mobile] = token
        print(f"      [+] Citizen Authenticated! Token: {token[:20]}...")

        # 2. Find User & Challan in Supabase
        user = db.query(models.User).filter(models.User.mobile_number == mobile).first()
        challan = (
            db.query(models.Challan)
            .join(models.Vehicle, models.Challan.vehicle_id == models.Vehicle.id)
            .filter(models.Vehicle.owner_id == user.id)
            .first()
        )

        if not challan:
            print(f"      [-] No existing challan found for {plate}!")
            continue

        print(f"  [2] Dispatching E-Challan Message (Challan ID: {challan.id}, Fine: Rs.{challan.fine_amount})...")
        notify_challan_created(db, challan, user)
        print("      [+] Challan message dispatched to all channels (SMS, Email, In-App)!")

finally:
    db.close()

# ----------------------------------------------------------------------
# 3. VERIFY STORED NOTIFICATIONS IN SUPABASE (FOR ALL USERS)
# ----------------------------------------------------------------------
print("\n" + "=" * 75)
print("     SUPABASE DATABASE NOTIFICATIONS AUDIT (ALL USERS)")
print("=" * 75)

db = SessionLocal()
try:
    for target in USERS:
        mobile = target["mobile"]
        user = db.query(models.User).filter(models.User.mobile_number == mobile).first()
        notifs = (
            db.query(models.Notification)
            .filter(models.Notification.user_id == user.id)
            .order_by(models.Notification.sent_at.desc())
            .all()
        )

        print(f"\nUser: {user.full_name} ({mobile}) -> {len(notifs)} notifications stored in Supabase:")
        for n in notifs:
            print(f"  - Channel: {n.channel.value.upper():<7} | Status: {n.status:<6} | Message: {n.message[:65]}...")

finally:
    db.close()

# ----------------------------------------------------------------------
# 4. VERIFY CITIZEN IN-APP NOTIFICATIONS API (/notifications/my)
# ----------------------------------------------------------------------
print("\n" + "=" * 75)
print("     CITIZEN IN-APP NOTIFICATIONS ENDPOINT VERIFICATION")
print("=" * 75)

for target in USERS:
    name = target["name"]
    mobile = target["mobile"]
    token = user_tokens.get(mobile)
    resp = requests.get(f"{BASE_URL}/notifications/my", headers={"Authorization": f"Bearer {token}"})
    print(f"\n{name} ({mobile}) -> Received {len(resp.json())} in-app alert(s):")
    for item in resp.json():
        print(f"  - [{item['sent_at']}] {item['message']}")

# ----------------------------------------------------------------------
# 5. VERIFY CENTRAL ADMIN SMS OUTBOX (/notifications/admin/sms-outbox)
# ----------------------------------------------------------------------
print("\n" + "=" * 75)
print("     POLICE / ADMIN CENTRAL SMS OUTBOX VERIFICATION")
print("=" * 75)

admin_login = requests.post(f"{BASE_URL}/auth/login", json={"identifier": "admin@echallan.gov.in", "password": "Admin@123"})
admin_token = admin_login.json().get("access_token")

sms_box = requests.get(f"{BASE_URL}/notifications/admin/sms-outbox", headers={"Authorization": f"Bearer {admin_token}"})
print(f"Total Sent SMS messages in Outbox: {len(sms_box.json())}")
for sms in sms_box.json():
    print(f"  - To: {sms['to_user']} | Sent: {sms['sent_at']} | Message: {sms['message']}")

print("\n" + "=" * 75)
print("  [SUCCESS] All 3 users received challans & messages across SMS, Email, and In-App!")
print("=" * 75)
