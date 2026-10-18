"""
Interactive & Configurable Demo Data Seeder for Traffic E-Challan System.

Seeds realistic citizens, vehicles, traffic police officers, admin accounts,
and sample challans from scripts/demo_data.json into PostgreSQL / Supabase.

Usage:
    # Standard seed (safe & idempotent — updates existing, adds new):
    python -m scripts.seed_demo_data

    # Add a custom person interactively from terminal:
    python -m scripts.seed_demo_data --add-citizen

    # Wipe and reseed clean:
    python -m scripts.seed_demo_data --clean
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.database import SessionLocal
from app import models
from app.core.security import hash_password


JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_data.json")


def load_demo_json(filepath: str = JSON_PATH) -> dict:
    if not os.path.exists(filepath):
        print(f"[!] Config file not found at: {filepath}")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_demo_json(data: dict, filepath: str = JSON_PATH):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[+] Saved updated configuration to {filepath}")


def ensure_violation_types(db):
    default_types = [
        ("NO_HELMET", "Riding without helmet", 500.0, "Section 194D, MV Act"),
        ("MOBILE_PHONE_USAGE", "Using mobile phone while driving", 1000.0, "Section 184, MV Act"),
        ("WRONG_SIDE_DRIVING", "Wrong-side / against traffic driving", 1500.0, "Section 177, MV Act"),
        ("TRIPLE_RIDING", "Triple riding on two-wheeler", 1000.0, "Section 128, MV Act"),
    ]
    type_map = {}
    for code, name, fine, legal in default_types:
        vt = db.query(models.ViolationType).filter(models.ViolationType.code == code).first()
        if not vt:
            vt = models.ViolationType(code=code, name=name, base_fine_amount=fine, legal_section=legal)
            db.add(vt)
            db.flush()
        type_map[code] = vt
    db.commit()
    return type_map


def clean_database(db):
    print("\n[!] Cleaning existing database data (Notifications, Payments, Evidence, Challans, Vehicles, Officers, OTPs, Users)...")
    db.query(models.Notification).delete()
    db.query(models.Payment).delete()
    db.query(models.Evidence).delete()
    db.query(models.Challan).delete()
    db.query(models.Vehicle).delete()
    db.query(models.Officer).delete()
    db.query(models.OtpCode).delete()
    db.query(models.User).delete()
    db.commit()
    print("[+] Database cleaned successfully.")


def seed_database(clean: bool = False):
    data = load_demo_json()
    db = SessionLocal()

    try:
        if clean:
            clean_database(db)

        vt_map = ensure_violation_types(db)

        # 1. Seed Admin
        admin_data = data.get("admin")
        if admin_data:
            admin_user = db.query(models.User).filter(models.User.email == admin_data["email"]).first()
            if not admin_user:
                admin_user = models.User(
                    full_name=admin_data["full_name"],
                    email=admin_data["email"],
                    mobile_number=admin_data.get("mobile_number"),
                    password_hash=hash_password(admin_data["password"]),
                    role=models.UserRole.admin,
                    is_verified=True,
                )
                db.add(admin_user)
            else:
                admin_user.full_name = admin_data["full_name"]
                admin_user.password_hash = hash_password(admin_data["password"])
                admin_user.is_verified = True
            db.flush()

        # 2. Seed Officers
        for off_data in data.get("officers", []):
            off_user = db.query(models.User).filter(models.User.email == off_data["email"]).first()
            if not off_user:
                off_user = models.User(
                    full_name=off_data["full_name"],
                    email=off_data["email"],
                    mobile_number=off_data.get("mobile_number"),
                    password_hash=hash_password(off_data["password"]),
                    role=models.UserRole.officer,
                    is_verified=True,
                )
                db.add(off_user)
                db.flush()
            else:
                off_user.full_name = off_data["full_name"]
                off_user.password_hash = hash_password(off_data["password"])

            off_prof = db.query(models.Officer).filter(models.Officer.user_id == off_user.id).first()
            if not off_prof:
                off_prof = models.Officer(
                    user_id=off_user.id,
                    badge_number=off_data["badge_number"],
                    station=off_data.get("station"),
                    jurisdiction=off_data.get("jurisdiction"),
                )
                db.add(off_prof)
            else:
                off_prof.badge_number = off_data["badge_number"]
                off_prof.station = off_data.get("station")
                off_prof.jurisdiction = off_data.get("jurisdiction")
            db.flush()

        # 3. Seed Citizens & Their Vehicles
        cheat_sheet = []
        for c_data in data.get("citizens", []):
            c_user = db.query(models.User).filter(models.User.mobile_number == c_data["mobile_number"]).first()
            if not c_user:
                c_user = models.User(
                    full_name=c_data["full_name"],
                    mobile_number=c_data["mobile_number"],
                    email=c_data.get("email"),
                    password_hash=hash_password(c_data["password"]),
                    role=models.UserRole.citizen,
                    is_verified=True,
                )
                db.add(c_user)
                db.flush()
            else:
                c_user.full_name = c_data["full_name"]
                c_user.email = c_data.get("email")
                c_user.is_verified = True

            user_plates = []
            user_challans_count = 0
            user_pending_amount = 0.0

            for v_data in c_data.get("vehicles", []):
                plate = v_data["plate_number"].upper().strip()
                veh = db.query(models.Vehicle).filter(models.Vehicle.plate_number == plate).first()
                if not veh:
                    veh = models.Vehicle(
                        plate_number=plate,
                        owner_id=c_user.id,
                        vehicle_type=v_data.get("vehicle_type", "motorcycle"),
                        model=v_data.get("model", "Standard"),
                        rto_code=v_data.get("rto_code", plate[:4]),
                        registration_date=datetime.utcnow() - timedelta(days=365),
                    )
                    db.add(veh)
                    db.flush()
                else:
                    veh.owner_id = c_user.id
                    veh.vehicle_type = v_data.get("vehicle_type", veh.vehicle_type)
                    veh.model = v_data.get("model", veh.model)

                user_plates.append(f"{plate} ({veh.model})")

                # Seed sample challans for this vehicle
                for ch_data in v_data.get("challans", []):
                    code = ch_data.get("violation_code")
                    vt = vt_map.get(code)
                    if not vt:
                        continue

                    # Check if challan already exists for this vehicle & location
                    existing_ch = (
                        db.query(models.Challan)
                        .filter(
                            models.Challan.vehicle_id == veh.id,
                            models.Challan.violation_type_id == vt.id,
                            models.Challan.location == ch_data.get("location"),
                        )
                        .first()
                    )
                    days_ago = ch_data.get("days_ago", 1)
                    violation_time = datetime.utcnow() - timedelta(days=days_ago)

                    if not existing_ch:
                        ch_status = (
                            models.ChallanStatus.paid
                            if ch_data.get("status") == "paid"
                            else models.ChallanStatus.pending
                        )
                        fine_amt = float(ch_data.get("fine_amount", vt.base_fine_amount))
                        new_ch = models.Challan(
                            vehicle_id=veh.id,
                            violation_type_id=vt.id,
                            detection_source=models.DetectionSource(ch_data.get("detection_source", "ai")),
                            fine_amount=fine_amt,
                            status=ch_status,
                            ai_confidence_score=0.92,
                            violation_datetime=violation_time,
                            location=ch_data.get("location", "FC Road, Pune"),
                            latitude=ch_data.get("latitude", 18.5204),
                            longitude=ch_data.get("longitude", 73.8567),
                        )
                        db.add(new_ch)
                        db.flush()

                        if ch_status == models.ChallanStatus.pending:
                            user_challans_count += 1
                            user_pending_amount += fine_amt
                    else:
                        if existing_ch.status == models.ChallanStatus.pending:
                            user_challans_count += 1
                            user_pending_amount += float(existing_ch.fine_amount)

            cheat_sheet.append({
                "name": c_data["full_name"],
                "mobile": c_data["mobile_number"],
                "vehicles": ", ".join(user_plates) or "None",
                "pending_challans": f"{user_challans_count} (Rs. {user_pending_amount:,.0f})",
            })

        # 4. Seed Unregistered RTO vehicles (ready for citizen signup demos)
        for unlinked in data.get("unregistered_rto_vehicles", []):
            plate = unlinked["plate_number"].upper().strip()
            veh = db.query(models.Vehicle).filter(models.Vehicle.plate_number == plate).first()
            if not veh:
                veh = models.Vehicle(
                    plate_number=plate,
                    owner_id=None,
                    vehicle_type=unlinked.get("vehicle_type", "motorcycle"),
                    model=unlinked.get("model", "Standard"),
                    rto_code=unlinked.get("rto_code", plate[:4]),
                    registration_date=datetime.utcnow() - timedelta(days=200),
                )
                db.add(veh)

        db.commit()

        # Display Cheat Sheet Table
        print("\n" + "=" * 90)
        print("          TRAFFIC E-CHALLAN -- DEMO DATABASE SEEDED SUCCESSFULLY")
        print("=" * 90)
        print("\n--- [POLICE & ADMIN] ADMINISTRATIVE CREDENTIALS ---")
        print(f"  System Admin   : admin@echallan.gov.in / Admin@123 (Mobile: 9000000001)")
        for off in data.get("officers", []):
            print(f"  Traffic Officer: {off['full_name']} | {off['email']} / {off['password']} (Mobile: {off['mobile_number']})")

        print("\n--- [CITIZENS] CITIZEN DEMO ACCOUNTS (Use Mobile Number for Live OTP Demo) ---")
        header = f"{'Citizen Name':<18} | {'Mobile No.':<12} | {'Registered Vehicle(s)':<35} | {'Pending Challans':<20}"
        print("-" * len(header))
        print(header)
        print("-" * len(header))
        for row in cheat_sheet:
            print(f"{row['name']:<18} | {row['mobile']:<12} | {row['vehicles']:<35} | {row['pending_challans']:<20}")
        print("-" * len(header))

        print("\n--- [UNCLAIMED RTO] VEHICLES READY FOR LIVE 'CITIZEN SIGNUP' DEMO ---")
        for unreg in data.get("unregistered_rto_vehicles", []):
            print(f"  Plate: {unreg['plate_number']} | {unreg['model']} ({unreg['vehicle_type']}) -> Ready for signup demo")

        print("=" * 90 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n[!] Error seeding database: {e}")
        raise e
    finally:
        db.close()


def add_custom_citizen_interactive():
    print("\n--- ADD CUSTOM PERSON / VEHICLE FOR DEMO ---")
    full_name = input("Enter Person's Full Name (e.g. Rahul Sharma): ").strip()
    mobile = input("Enter 10-digit Mobile Number (e.g. 9822334455): ").strip()
    email = input(f"Enter Email address [{mobile}@example.com]: ").strip() or f"{mobile}@example.com"
    plate = input("Enter Vehicle Number (e.g. MH12AB9999): ").strip().upper()
    model = input("Enter Vehicle Model (e.g. Honda Activa / Swift): ").strip() or "Standard"
    v_type = input("Enter Vehicle Type [motorcycle / car / scooter]: ").strip().lower() or "motorcycle"

    if not full_name or not mobile or not plate:
        print("[!] Full name, mobile number, and vehicle plate are required.")
        return

    data = load_demo_json()

    # Append to citizens
    new_citizen = {
        "full_name": full_name,
        "mobile_number": mobile,
        "email": email,
        "password": "Citizen@123",
        "vehicles": [
            {
                "plate_number": plate,
                "vehicle_type": v_type,
                "model": model,
                "rto_code": plate[:4],
                "challans": [
                    {
                        "violation_code": "NO_HELMET",
                        "detection_source": "ai",
                        "fine_amount": 500.0,
                        "status": "pending",
                        "location": "FC Road, Pune",
                        "days_ago": 1
                    }
                ]
            }
        ]
    }
    data["citizens"].append(new_citizen)
    save_demo_json(data)
    print(f"[+] Successfully added {full_name} ({plate}) to demo_data.json!")
    print("[*] Now seeding changes into the database...")
    seed_database(clean=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo citizens, vehicles, and officers.")
    parser.add_argument("--clean", action="store_true", help="Wipe existing records before seeding")
    parser.add_argument("--add-citizen", action="store_true", help="Interactively add a custom person and vehicle")
    args = parser.parse_args()

    if args.add_citizen:
        add_custom_citizen_interactive()
    else:
        seed_database(clean=args.clean)
