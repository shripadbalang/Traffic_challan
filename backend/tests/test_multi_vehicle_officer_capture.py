"""
Integration tests for Officer Multi-Vehicle Violation Detection & Automatic Challan Generation.
Validates:
- Capturing a single frame containing multiple vehicles.
- Independent analysis of each detected vehicle for violations.
- Automatic challan generation for each confirmed violation.
- Display of unreadable plates for officer review without auto-challaning.
- Clean / compliant vehicle reporting.
- Prevention of duplicate challans.
- Vehicle-type eligibility enforcement across multiple vehicles.
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


def _make_dummy_image_bytes():
    buf = BytesIO()
    img = Image.new("RGB", (640, 480), color=(100, 150, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestMultiVehicleOfficerCapture(unittest.TestCase):
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

        # Seed Violation Types
        cls.vt_helmet = models.ViolationType(
            code="NO_HELMET",
            name="No Helmet",
            base_fine_amount=500.0,
            legal_section="129/177 MVA",
        )
        cls.vt_wrong = models.ViolationType(
            code="WRONG_SIDE_DRIVING",
            name="Wrong Side Driving",
            base_fine_amount=1000.0,
            legal_section="119/177 MVA",
        )
        cls.vt_triple = models.ViolationType(
            code="TRIPLE_RIDING",
            name="Triple Riding",
            base_fine_amount=1000.0,
            legal_section="128/177 MVA",
        )
        db.add_all([cls.vt_helmet, cls.vt_wrong, cls.vt_triple])

        # Officer user
        cls.officer_user = models.User(
            full_name="Patrol Officer Sharma",
            email="patrol_sharma@example.com",
            mobile_number="9876543210",
            password_hash=hash_password("OfficerPass@123"),
            role=models.UserRole.officer,
            is_verified=True,
        )
        db.add(cls.officer_user)
        db.flush()

        cls.officer_profile = models.Officer(
            user_id=cls.officer_user.id,
            badge_number="MH-OFF-7001",
            station="Shivajinagar Traffic Division",
            jurisdiction="JM Road, Pune",
        )
        db.add(cls.officer_profile)

        # Registered Vehicles
        cls.moto_1 = models.Vehicle(
            plate_number="MH12DE1433",
            vehicle_type="Motorcycle",
            model="Hero Splendor",
        )
        cls.moto_2 = models.Vehicle(
            plate_number="MH14EU4321",
            vehicle_type="Motorcycle",
            model="Bajaj Pulsar",
        )
        cls.car_1 = models.Vehicle(
            plate_number="MH20EE9999",
            vehicle_type="Car",
            model="Hyundai Creta",
        )
        db.add_all([cls.moto_1, cls.moto_2, cls.car_1])
        db.commit()

        cls.token = create_access_token(
            subject=str(cls.officer_user.id), role="officer"
        )
        cls.headers = {"Authorization": f"Bearer {cls.token}"}
        db.close()

    def setUp(self):
        self.image_bytes = _make_dummy_image_bytes()
        db = self.TestingSessionLocal()
        db.query(models.Evidence).delete()
        db.query(models.Challan).delete()
        db.commit()
        db.close()

    @patch("app.routers.officer.send_challan_notification")
    @patch("app.routers.officer.run_detection")
    def test_multi_vehicle_both_violations_create_challans(self, mock_detect, mock_notify):
        """Single frame with 2 violating motorcycles -> 2 distinct challans automatically created."""
        mock_notify.return_value = {"success": True, "status": "sent", "recipient_email": "test@example.com"}
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "wrong_side"],
            plate_number="MH12DE1433",
            plate_confidence=0.95,
            boxes=[
                schemas.DetectionBox(class_name="no_helmet", confidence=0.88, bbox=[10, 10, 50, 50]),
                schemas.DetectionBox(class_name="wrong_side", confidence=0.91, bbox=[100, 100, 200, 200]),
            ],
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    confidence=0.92,
                    bbox=[5, 5, 80, 120],
                    plate_number="MH12DE1433",
                    plate_confidence=0.95,
                    violations_found=["no_helmet"],
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="motorcycle",
                    confidence=0.89,
                    bbox=[90, 90, 220, 250],
                    plate_number="MH14EU4321",
                    plate_confidence=0.94,
                    violations_found=["wrong_side"],
                ),
            ],
            inference_time_ms=75.4,
            ocr_time_ms=120.3,
            processing_time_ms=198.5,
        )

        response = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("multi_frame.jpg", self.image_bytes, "image/jpeg")},
            data={"location": "JM Road Junction"},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "VIOLATION_DETECTED")
        self.assertEqual(data["total_vehicles_detected"], 2)
        self.assertEqual(data["total_challans_created"], 2)
        self.assertEqual(len(data["vehicles"]), 2)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12DE1433")
        self.assertEqual(data["vehicles"][1]["vehicle_number"], "MH14EU4321")
        self.assertEqual(data["total_fine_amount"], 1500.0)
        self.assertEqual(data["processing_time_ms"], 198.5)

    @patch("app.routers.officer.send_challan_notification")
    @patch("app.routers.officer.run_detection")
    def test_multi_vehicle_one_violating_one_clean(self, mock_detect, mock_notify):
        """Frame with 1 violating motorcycle and 1 clean car -> 1 challan, car marked clean."""
        mock_notify.return_value = {"success": True, "status": "sent"}
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH12DE1433",
            plate_confidence=0.95,
            boxes=[],
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    confidence=0.92,
                    bbox=[5, 5, 80, 120],
                    plate_number="MH12DE1433",
                    plate_confidence=0.95,
                    violations_found=["no_helmet"],
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="car",
                    confidence=0.95,
                    bbox=[200, 200, 450, 400],
                    plate_number="MH20EE9999",
                    plate_confidence=0.97,
                    violations_found=[],
                ),
            ],
        )

        response = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("traffic.jpg", self.image_bytes, "image/jpeg")},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "VIOLATION_DETECTED")
        self.assertEqual(data["total_challans_created"], 1)
        self.assertEqual(len(data["vehicles"]), 1)
        self.assertEqual(data["vehicles"][0]["vehicle_number"], "MH12DE1433")
        self.assertEqual(len(data["clean_vehicles"]), 1)
        self.assertEqual(data["clean_vehicles"][0]["plate_number"], "MH20EE9999")

    @patch("app.routers.officer.run_detection")
    def test_multi_vehicle_unreadable_plate_requires_review(self, mock_detect):
        """Violating vehicle with unreadable plate is not auto-challaned; flagged for officer review."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number=None,
            plate_confidence=None,
            boxes=[],
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    confidence=0.91,
                    bbox=[10, 10, 90, 130],
                    plate_number=None,
                    plate_confidence=None,
                    violations_found=["no_helmet"],
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="car",
                    confidence=0.95,
                    bbox=[200, 200, 450, 400],
                    plate_number="MH20EE9999",
                    plate_confidence=0.97,
                    violations_found=[],
                ),
            ],
        )

        response = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("traffic_blurry.jpg", self.image_bytes, "image/jpeg")},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "PLATE_NOT_FOUND")
        self.assertEqual(len(data["unreadable_vehicles"]), 1)
        self.assertEqual(data["unreadable_vehicles"][0]["vehicle_type"], "motorcycle")
        self.assertIn("no_helmet", data["unreadable_vehicles"][0]["violations"])

    @patch("app.routers.officer.run_detection")
    def test_frame_with_no_violations(self, mock_detect):
        """Frame where all vehicles are compliant returns NO_VIOLATION."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=[],
            plate_number="MH12DE1433",
            plate_confidence=0.94,
            boxes=[],
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    confidence=0.90,
                    bbox=[10, 10, 90, 130],
                    plate_number="MH12DE1433",
                    plate_confidence=0.94,
                    violations_found=[],
                ),
                schemas.DetectedVehicle(
                    vehicle_id=2,
                    vehicle_type="car",
                    confidence=0.94,
                    bbox=[200, 200, 450, 400],
                    plate_number="MH20EE9999",
                    plate_confidence=0.96,
                    violations_found=[],
                ),
            ],
        )

        response = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("clean_traffic.jpg", self.image_bytes, "image/jpeg")},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "NO_VIOLATION")
        self.assertEqual(data["total_vehicles_detected"], 2)

    @patch("app.routers.officer.send_challan_notification")
    @patch("app.routers.officer.run_detection")
    def test_multi_vehicle_duplicate_prevention(self, mock_detect, mock_notify):
        """Submitting the same violating vehicle twice within 5 minutes prevents duplicate challans."""
        mock_notify.return_value = {"success": True, "status": "sent"}
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["wrong_side"],
            plate_number="MH14EU4321",
            plate_confidence=0.94,
            boxes=[],
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    confidence=0.91,
                    bbox=[10, 10, 90, 130],
                    plate_number="MH14EU4321",
                    plate_confidence=0.94,
                    violations_found=["wrong_side"],
                ),
            ],
        )

        # First submission
        r1 = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("dup_check.jpg", self.image_bytes, "image/jpeg")},
            headers=self.headers,
        )
        self.assertEqual(r1.status_code, 200)
        data1 = r1.json()
        self.assertEqual(data1["status"], "VIOLATION_DETECTED")

        # Second submission (immediate retry)
        r2 = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("dup_check.jpg", self.image_bytes, "image/jpeg")},
            headers=self.headers,
        )
        self.assertEqual(r2.status_code, 200)
        data2 = r2.json()
        self.assertEqual(data2["status"], "DUPLICATE_PREVENTED")


if __name__ == "__main__":
    unittest.main()
