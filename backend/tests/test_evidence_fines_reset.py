import os
import sys
import uuid
import json
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app import models
from app.services.challan_engine import (
    get_fine_rates,
    calculate_violation_fine,
    create_combined_challan,
)
from app.core.security import create_access_token
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_fine_rates_defaults():
    db = SessionLocal()
    try:
        rates = get_fine_rates(db)
        assert rates["fine_helmet"] == 500.0, f"Expected 500, got {rates['fine_helmet']}"
        assert rates["fine_triple_riding"] == 1000.0, f"Expected 1000, got {rates['fine_triple_riding']}"
        assert rates["fine_wrong_side"] == 1500.0, f"Expected 1500, got {rates['fine_wrong_side']}"
        assert rates["fine_all_three_combined"] == 2000.0, f"Expected 2000, got {rates['fine_all_three_combined']}"
    finally:
        db.close()


def test_violation_combinations():
    db = SessionLocal()
    try:
        # 1. Helmet only = 500
        fine, bd = calculate_violation_fine(db, ["NO_HELMET"])
        assert fine == 500.0
        assert bd["original_total"] == 500.0
        assert bd["special_discount"] == 0.0

        # 2. Triple riding only = 1000
        fine, bd = calculate_violation_fine(db, ["TRIPLE_RIDING"])
        assert fine == 1000.0
        assert bd["original_total"] == 1000.0

        # 3. Wrong-side only = 1500
        fine, bd = calculate_violation_fine(db, ["WRONG_SIDE_DRIVING"])
        assert fine == 1500.0
        assert bd["original_total"] == 1500.0

        # 4. Helmet + Triple riding = 1500
        fine, bd = calculate_violation_fine(db, ["NO_HELMET", "TRIPLE_RIDING"])
        assert fine == 1500.0
        assert bd["original_total"] == 1500.0

        # 5. Helmet + Wrong-side = 2000
        fine, bd = calculate_violation_fine(db, ["NO_HELMET", "WRONG_SIDE_DRIVING"])
        assert fine == 2000.0
        assert bd["original_total"] == 2000.0

        # 6. Triple riding + Wrong-side = 2500
        fine, bd = calculate_violation_fine(db, ["TRIPLE_RIDING", "WRONG_SIDE_DRIVING"])
        assert fine == 2500.0
        assert bd["original_total"] == 2500.0

        # 7. ALL THREE = 2000 (special combined discount of 1000)
        fine, bd = calculate_violation_fine(db, ["NO_HELMET", "TRIPLE_RIDING", "WRONG_SIDE_DRIVING"])
        assert fine == 2000.0, f"Expected 2000 for all 3 violations, got {fine}"
        assert bd["original_total"] == 3000.0
        assert bd["special_discount"] == 1000.0
        assert bd["rule_applied"] == "all_three_special_combined"
    finally:
        db.close()


def test_combined_challan_generation_and_evidence_attachment():
    db = SessionLocal()
    try:
        # Create a test vehicle and owner
        owner = db.query(models.User).filter(models.User.email == "test_owner_a@example.com").first()
        if not owner:
            owner = models.User(
                id=uuid.uuid4(),
                email="test_owner_a@example.com",
                full_name="Owner A",
                mobile_number="9800000001",
                role=models.UserRole.citizen,
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)

        vehicle = db.query(models.Vehicle).filter(models.Vehicle.plate_number == "MH12TEST01").first()
        if not vehicle:
            vehicle = models.Vehicle(
                plate_number="MH12TEST01",
                vehicle_type="motorcycle",
                model="Test Bike",
                owner_id=owner.id,
                registered_mobile="9800000001",
            )
            db.add(vehicle)
            db.commit()
            db.refresh(vehicle)

        # Create combined challan for all 3 violations
        challan = create_combined_challan(
            db=db,
            vehicle=vehicle,
            violation_codes=["NO_HELMET", "TRIPLE_RIDING", "WRONG_SIDE_DRIVING"],
            detection_source=models.DetectionSource.ai,
            ai_confidence_score=0.95,
            location="Test Junction, Pune",
        )
        assert challan is not None
        assert challan.fine_amount == 2000.0
        assert challan.notes is not None
        breakdown = json.loads(challan.notes)
        assert breakdown["final_amount"] == 2000.0
        assert len(breakdown["violations"]) == 3

        # Attach evidence
        ev = models.Evidence(
            challan_id=challan.id,
            file_path="storage/evidence/test_evidence.jpg",
            file_type="image",
        )
        db.add(ev)
        db.commit()

        # Token for Owner A
        token_a = create_access_token(subject=str(owner.id), role="citizen")

        # Owner A can access evidence
        res_a = client.get(f"/challans/{challan.id}/evidence?token={token_a}")
        assert res_a.status_code == 200, f"Owner A should access evidence, got {res_a.status_code}"
        assert res_a.headers.get("content-type") == "image/jpeg"

        # Owner B (different user)
        owner_b = db.query(models.User).filter(models.User.email == "test_owner_b@example.com").first()
        if not owner_b:
            owner_b = models.User(
                id=uuid.uuid4(),
                email="test_owner_b@example.com",
                full_name="Owner B",
                mobile_number="9800000002",
                role=models.UserRole.citizen,
            )
            db.add(owner_b)
            db.commit()
            db.refresh(owner_b)

        token_b = create_access_token(subject=str(owner_b.id), role="citizen")

        # IDOR test: Owner B cannot access Owner A's evidence
        res_b = client.get(f"/challans/{challan.id}/evidence?token={token_b}")
        assert res_b.status_code == 403, f"Owner B should be rejected with 403 Forbidden, got {res_b.status_code}"

        # Unauthenticated request
        res_unauth = client.get(f"/challans/{challan.id}/evidence")
        assert res_unauth.status_code == 401, f"Unauthenticated request should return 401, got {res_unauth.status_code}"

        # Clean up test challan
        db.query(models.Evidence).filter(models.Evidence.challan_id == challan.id).delete()
        db.query(models.Challan).filter(models.Challan.id == challan.id).delete()
        db.commit()
    finally:
        db.close()


def test_admin_fine_settings_and_history_reset():
    db = SessionLocal()
    try:
        admin_user = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
        assert admin_user is not None, "Admin user must exist"

        admin_token = create_access_token(subject=str(admin_user.id), role="admin")

        # 1. Admin gets current fine settings
        res = client.get("/admin/fine-settings", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()
        assert "fine_helmet" in data

        # 2. Non-admin cannot modify settings
        citizen_user = db.query(models.User).filter(models.User.role == models.UserRole.citizen).first()
        citizen_token = create_access_token(subject=str(citizen_user.id), role="citizen")
        res_fail = client.put(
            "/admin/fine-settings",
            headers={"Authorization": f"Bearer {citizen_token}"},
            json={
                "fine_helmet": 600,
                "fine_triple_riding": 1200,
                "fine_wrong_side": 1800,
                "fine_all_three_combined": 2200,
            },
        )
        assert res_fail.status_code == 403, "Non-admin should get 403 Forbidden"

        # 3. Admin updates settings
        res_update = client.put(
            "/admin/fine-settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "fine_helmet": 550,
                "fine_triple_riding": 1100,
                "fine_wrong_side": 1600,
                "fine_all_three_combined": 2000,
            },
        )
        assert res_update.status_code == 200
        updated = res_update.json()
        assert updated["fine_helmet"] == 550

        # Verify rates updated in database
        rates = get_fine_rates(db)
        assert rates["fine_helmet"] == 550.0

        # Restore default rates
        client.put(
            "/admin/fine-settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "fine_helmet": 500,
                "fine_triple_riding": 1000,
                "fine_wrong_side": 1500,
                "fine_all_three_combined": 2000,
            },
        )

        # 4. History reset endpoint test
        res_reset_fail = client.post(
            "/admin/reset-challan-history",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"confirm": "WRONG_PHRASE"},
        )
        assert res_reset_fail.status_code == 400

        res_reset = client.post(
            "/admin/reset-challan-history",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"confirm": "RESET_ALL_CHALLANS"},
        )
        assert res_reset.status_code == 200
        assert res_reset.json()["success"] is True

        # Check overview shows 0 challans
        res_overview = client.get("/admin/analytics/overview", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_overview.status_code == 200
        assert res_overview.json()["total_challans"] == 0
    finally:
        db.close()


if __name__ == "__main__":
    test_fine_rates_defaults()
    print("[PASS] test_fine_rates_defaults passed")
    test_violation_combinations()
    print("[PASS] test_violation_combinations passed")
    test_combined_challan_generation_and_evidence_attachment()
    print("[PASS] test_combined_challan_generation_and_evidence_attachment passed")
    test_admin_fine_settings_and_history_reset()
    print("[PASS] test_admin_fine_settings_and_history_reset passed")
    print("\nALL TESTS PASSED SUCCESSFULLY!")
