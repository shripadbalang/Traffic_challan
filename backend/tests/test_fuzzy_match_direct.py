import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app import models
from app.services.plate_matcher import find_vehicle_by_plate
from app.services.challan_engine import create_challan
from app.services.notification_service import notify_challan_created

db = SessionLocal()

DETECTED_PLATE = "MH37AB09"  # simulating an imperfect OCR reading

print("=" * 60)
print(f"Simulated detected plate reading: '{DETECTED_PLATE}'")
print("=" * 60)

vehicle, match_confidence = find_vehicle_by_plate(db, DETECTED_PLATE)

if not vehicle:
    print("\nNo match found. Check that MH37AB0940 was inserted correctly.")
else:
    print(f"\nMatched vehicle plate : {vehicle.plate_number}")
    print(f"Match confidence      : {match_confidence:.1%}")
    print(f"Owner                 : {vehicle.owner.full_name if vehicle.owner else 'NO OWNER LINKED'}")
    print(f"Owner mobile          : {vehicle.owner.mobile_number if vehicle.owner else 'N/A'}")
    print(f"Owner email           : {vehicle.owner.email if vehicle.owner else 'N/A'}")

    violation_type = db.query(models.ViolationType).filter(models.ViolationType.code == "NO_HELMET").first()

    print("\n" + "=" * 60)
    print("Creating challan...")
    print("=" * 60)
    challan = create_challan(
        db=db,
        vehicle=vehicle,
        violation_type=violation_type,
        detection_source=models.DetectionSource.ai,
        ai_confidence_score=0.85 * match_confidence,
        location="Test Location, Pune",
    )
    print(f"Challan created: {challan.id}")
    print(f"Fine amount: Rs. {challan.fine_amount}")

    if vehicle.owner:
        notify_challan_created(db, challan, vehicle.owner)
        print("\nNotifications fired (check terminal below for simulated email/SMS logs).")
    else:
        print("\nNo owner linked — no notification sent.")

db.close()