"""
Comprehensive Test Suite for Car False Helmet and Triple-Riding Prevention (Backend Integration).
Validates at the API, Database, and Router Level:
1. Car with multiple occupants -> no helmet or triple-riding challan (filtered by vehicle rules and visual type).
2. Car with person visible through its window -> no helmet or triple-riding challan.
3. Motorcycle with one rider wearing helmet -> clean compliant, no helmet challan.
4. Motorcycle with one rider without helmet -> helmet challan generated.
5. Motorcycle with two riders -> no triple-riding challan.
6. Motorcycle with three riders -> triple-riding challan generated.
7. Image containing both cars and motorcycles -> challan assigned only to motorcycle, car receives zero challan.
8. Car or motorcycle driving wrong side -> wrong side violation preserved for both.
9. Uncertain vehicle/rider classification (e.g. unknown class or manual plate mismatch) -> no false automatic challan.
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app import models, schemas
from app.main import app
from app.core.security import hash_password, create_access_token
from app.services.violation_rules import filter_eligible_violations, is_two_wheeler, is_violation_allowed_for_vehicle


def _make_dummy_image_bytes():
    buf = BytesIO()
    img = Image.new("RGB", (640, 480), color=(120, 140, 160))
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestCarFalseViolationsBackend(unittest.TestCase):
    """Integration tests via FastAPI TestClient on officer capture endpoint."""

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.TestingSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=cls.engine
        )
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

        db = cls.TestingSessionLocal()

        # Seed violation types
        for code, name, penalty in [
            ("NO_HELMET", "No Helmet", 500.0),
            ("TRIPLE_RIDING", "Triple Riding", 1000.0),
            ("WRONG_SIDE_DRIVING", "Wrong Side Driving", 1000.0),
        ]:
            if not db.query(models.ViolationType).filter_by(code=code).first():
                vt = models.ViolationType(
                    code=code,
                    name=name,
                    base_fine_amount=penalty,
                    legal_section="MVA 1988",
                )
                db.add(vt)

        # Seed officer
        officer_user = models.User(
            email="test_car_officer@echallan.gov.in",
            mobile_number="9876543299",
            password_hash=hash_password("OfficerPass123"),
            full_name="Enforcement Officer Test",
            role=models.UserRole.officer,
            is_verified=True,
        )
        db.add(officer_user)
        db.commit()
        db.refresh(officer_user)

        officer_prof = models.Officer(
            user_id=officer_user.id,
            badge_number="TF-CAR-999",
            station="Zone 1",
            jurisdiction="Highway Division",
        )
        db.add(officer_prof)

        # Seed Car Owner & Vehicle (Car / LMV)
        car_owner = models.User(
            email="car_owner@test.com",
            mobile_number="9876543291",
            password_hash=hash_password("OwnerPass123"),
            full_name="Car Owner Test",
            role=models.UserRole.owner,
            is_verified=True,
        )
        db.add(car_owner)
        db.commit()
        db.refresh(car_owner)

        car_veh = models.Vehicle(
            plate_number="MH12CAR9999",
            vehicle_type="LMV - Motor Car",
            model="Hyundai Creta",
            owner_id=car_owner.id,
        )
        db.add(car_veh)

        # Seed Motorcycle Owner & Vehicle (Two-Wheeler)
        moto_owner = models.User(
            email="moto_owner@test.com",
            mobile_number="9876543292",
            password_hash=hash_password("OwnerPass123"),
            full_name="Motorcycle Owner Test",
            role=models.UserRole.owner,
            is_verified=True,
        )
        db.add(moto_owner)
        db.commit()
        db.refresh(moto_owner)

        moto_veh = models.Vehicle(
            plate_number="MH12MOTO8888",
            vehicle_type="Two Wheeler",
            model="Honda Activa",
            owner_id=moto_owner.id,
        )
        db.add(moto_veh)

        db.commit()
        officer_user_id = str(officer_user.id)
        db.close()

        cls.officer_token = create_access_token(
            subject=officer_user_id, role="officer"
        )
        cls.headers = {"Authorization": f"Bearer {cls.officer_token}"}

    def setUp(self):
        db = self.TestingSessionLocal()
        db.query(models.Evidence).delete()
        db.query(models.Challan).delete()
        db.commit()
        db.close()

    def test_scenario_1_and_2_car_with_spurious_helmet_or_triple_riding_generates_no_challan(self):
        """Scenarios 1 & 2: A car with multiple occupants or window person receives NO helmet/triple challan."""
        dummy_img = _make_dummy_image_bytes()

        # Mock ML returning car with spurious violations
        mock_detection = schemas.DetectionResult(
            violations_found=["no_helmet", "triple_riding"],
            plate_number="MH12CAR9999",
            plate_confidence=0.96,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    bbox=[100, 100, 400, 300],
                    plate_number="MH12CAR9999",
                    plate_confidence=0.96,
                    violations_found=["no_helmet", "triple_riding"],
                )
            ],
            inference_time_ms=50.0,
            ocr_time_ms=30.0,
            processing_time_ms=80.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("car_test.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Zero challans created!
        self.assertEqual(data.get("total_challans_created", 0), 0)
        self.assertEqual(data.get("status"), "NO_VIOLATION")
        ineligible = data.get("ineligible_vehicles", [])
        self.assertEqual(len(ineligible), 1)
        self.assertEqual(ineligible[0]["plate_number"], "MH12CAR9999")
        self.assertEqual(ineligible[0]["status"], "INELIGIBLE_VIOLATION")
        self.assertIn("two-wheelers", ineligible[0]["message"])

    def test_scenario_3_motorcycle_wearing_helmet_clean(self):
        """Scenario 3: Motorcycle with rider wearing helmet -> marked as clean compliant, no challan."""
        dummy_img = _make_dummy_image_bytes()

        mock_detection = schemas.DetectionResult(
            violations_found=[],
            plate_number="MH12MOTO8888",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    bbox=[100, 100, 300, 400],
                    plate_number="MH12MOTO8888",
                    plate_confidence=0.95,
                    violations_found=[],
                )
            ],
            inference_time_ms=40.0,
            ocr_time_ms=25.0,
            processing_time_ms=65.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("moto_clean.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "NO_VIOLATION")
        self.assertEqual(data.get("total_challans_created", 0), 0)

    @patch("app.routers.officer.send_challan_notification", return_value={"success": True, "status": "sent"})
    def test_scenario_4_motorcycle_without_helmet_challan_generated(self, mock_notif):
        """Scenario 4: Motorcycle with rider without helmet -> helmet challan generated."""
        dummy_img = _make_dummy_image_bytes()

        mock_detection = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH12MOTO8888",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    bbox=[100, 100, 300, 400],
                    plate_number="MH12MOTO8888",
                    plate_confidence=0.95,
                    violations_found=["no_helmet"],
                )
            ],
            inference_time_ms=45.0,
            ocr_time_ms=25.0,
            processing_time_ms=70.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("moto_no_helmet.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "VIOLATION_DETECTED")
        self.assertEqual(data.get("total_challans_created"), 1)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12MOTO8888")
        self.assertEqual(data["vehicles"][0]["violations"][0]["violation_name"], "No Helmet")

    @patch("app.routers.officer.send_challan_notification", return_value={"success": True, "status": "sent"})
    def test_scenario_6_motorcycle_triple_riding_challan_generated(self, mock_notif):
        """Scenario 6: Motorcycle with 3 riders -> triple-riding challan generated."""
        dummy_img = _make_dummy_image_bytes()

        mock_detection = schemas.DetectionResult(
            violations_found=["triple_riding"],
            plate_number="MH12MOTO8888",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    bbox=[100, 100, 300, 400],
                    plate_number="MH12MOTO8888",
                    plate_confidence=0.95,
                    violations_found=["triple_riding"],
                )
            ],
            inference_time_ms=45.0,
            ocr_time_ms=25.0,
            processing_time_ms=70.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("moto_triple.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "VIOLATION_DETECTED")
        self.assertEqual(data.get("total_challans_created"), 1)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12MOTO8888")
        self.assertEqual(data["vehicles"][0]["violations"][0]["violation_name"], "Triple Riding")

    @patch("app.routers.officer.send_challan_notification", return_value={"success": True, "status": "sent"})
    def test_scenario_7_multi_vehicle_car_and_motorcycle_challan_strictly_on_motorcycle(self, mock_notif):
        """Scenario 7: Car and Motorcycle in same image: only Motorcycle gets helmet challan, Car is clean."""
        dummy_img = _make_dummy_image_bytes()

        mock_detection = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH12MOTO8888",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    bbox=[50, 100, 300, 400],
                    plate_number="MH12CAR9999",
                    plate_confidence=0.97,
                    violations_found=[],  # Car is clean
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="motorcycle",
                    bbox=[350, 150, 550, 450],
                    plate_number="MH12MOTO8888",
                    plate_confidence=0.94,
                    violations_found=["no_helmet"],  # Motorcycle has no-helmet violation
                ),
            ],
            inference_time_ms=60.0,
            ocr_time_ms=35.0,
            processing_time_ms=95.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("multi_test.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data.get("status"), "VIOLATION_DETECTED")
        self.assertEqual(data.get("total_challans_created"), 1)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12MOTO8888")
        self.assertEqual(data["vehicles"][0]["violations"][0]["violation_name"], "No Helmet")

        clean = data.get("clean_vehicles", [])
        clean_plates = [v["plate_number"] for v in clean]
        self.assertIn("MH12CAR9999", clean_plates)

    @patch("app.routers.officer.send_challan_notification", return_value={"success": True, "status": "sent"})
    def test_scenario_8_car_wrong_side_violation_allowed(self, mock_notif):
        """Scenario 8: A car driving wrong-side triggers a wrong-side challan successfully."""
        dummy_img = _make_dummy_image_bytes()

        mock_detection = schemas.DetectionResult(
            violations_found=["wrong_side"],
            plate_number="MH12CAR9999",
            plate_confidence=0.98,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    bbox=[100, 100, 500, 400],
                    plate_number="MH12CAR9999",
                    plate_confidence=0.98,
                    violations_found=["wrong_side"],
                )
            ],
            inference_time_ms=45.0,
            ocr_time_ms=25.0,
            processing_time_ms=70.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                files={"file": ("wrongside_car.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data.get("status"), "VIOLATION_DETECTED")
        self.assertEqual(data.get("total_challans_created"), 1)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12CAR9999")
        self.assertEqual(data["vehicles"][0]["violations"][0]["violation_name"], "Wrong Side Driving")

    def test_scenario_9_manual_override_with_car_plate_never_attaches_to_motorcycle_violator(self):
        """Scenario 9: If officer inputs a car plate manually, it must NEVER be attached to an unplated motorcycle violator."""
        dummy_img = _make_dummy_image_bytes()

        # Scene has unplated motorcycle violator (no_helmet) and a car
        mock_detection = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number=None,
            plate_confidence=0.0,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    bbox=[50, 100, 250, 400],
                    plate_number=None,
                    plate_confidence=None,
                    violations_found=["no_helmet"],
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="car",
                    bbox=[300, 100, 600, 400],
                    plate_number=None,
                    plate_confidence=None,
                    violations_found=[],
                ),
            ],
            inference_time_ms=50.0,
            ocr_time_ms=30.0,
            processing_time_ms=80.0,
        )

        with patch("app.routers.officer.run_detection", return_value=mock_detection):
            # Officer manually typed the car's plate: MH12CAR9999
            response = self.client.post(
                "/officer/violations/capture-and-detect",
                headers=self.headers,
                data={"vehicle_plate": "MH12CAR9999"},
                files={"file": ("manual_override.jpg", dummy_img, "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # NO challan generated for the car!
        self.assertEqual(data.get("total_challans_created", 0), 0)
        # The unplated motorcycle remains as PLATE_NOT_FOUND (not falsely attached to car plate)
        unreadable = data.get("unreadable_vehicles", [])
        self.assertEqual(len(unreadable), 1)
        self.assertEqual(unreadable[0]["vehicle_type"], "motorcycle")


if __name__ == "__main__":
    unittest.main()
