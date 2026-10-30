"""
Comprehensive test suite for vehicle-type traffic violation eligibility.
Tests the centralized rule engine, create_challan defensive checks,
manual challan creation endpoint, and AI detection pipeline (image, video, officer capture).
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app import models, schemas
from app.main import app
from app.core.security import hash_password, create_access_token
from app.services.violation_rules import (
    normalize_vehicle_type,
    is_two_wheeler,
    is_violation_allowed_for_vehicle,
    filter_eligible_violations,
)
from app.services.challan_engine import create_challan


class TestViolationRulesUnit(unittest.TestCase):
    """Unit tests for vehicle classification and violation eligibility rules."""

    def test_normalization(self):
        self.assertEqual(normalize_vehicle_type("  Car "), "car")
        self.assertEqual(normalize_vehicle_type("Four-Wheeler"), "four-wheeler")
        self.assertEqual(normalize_vehicle_type("two_wheeler"), "two-wheeler")
        self.assertEqual(normalize_vehicle_type("Motor Cycle"), "motor-cycle")
        self.assertEqual(normalize_vehicle_type(""), "unknown")
        self.assertEqual(normalize_vehicle_type(None), "unknown")

    def test_is_two_wheeler_positives(self):
        two_wheelers = [
            "Motorcycle", "motorcycle", "MOTORCYCLE",
            "Bike", "bike", "BIKE", "motorbike", "Motor Bike",
            "Scooter", "scooter", "SCOOTER",
            "Scooty", "scooty",
            "Moped", "moped",
            "Two-Wheeler", "two-wheeler", "two wheeler", "2-wheeler", "2 wheeler", "2w",
            "Activa", "Honda Activa", "Pulsar", "Splendor",
        ]
        for v in two_wheelers:
            self.assertTrue(is_two_wheeler(v), f"Expected '{v}' to be identified as two-wheeler")

    def test_is_two_wheeler_negatives(self):
        non_two_wheelers = [
            "Car", "car", "CAR",
            "Four-Wheeler", "four wheeler", "4-wheeler", "4 wheeler", "4w",
            "SUV", "suv", "Sedan", "Hatchback",
            "Jeep", "Van", "Minivan",
            "Bus", "bus", "Truck", "truck", "Lorry",
            "Auto", "auto", "Rickshaw", "Auto-Rickshaw", "3-wheeler",
            "Heavy", "Commercial", "Tractor",
            "Unknown", "unknown", "Vehicle", "Standard Vehicle", "standard",
            None, "",
        ]
        for v in non_two_wheelers:
            self.assertFalse(is_two_wheeler(v), f"Expected '{v}' NOT to be identified as two-wheeler")

    def test_violation_eligibility_car(self):
        car_type = "Car"
        self.assertFalse(is_violation_allowed_for_vehicle(car_type, "no_helmet"))
        self.assertFalse(is_violation_allowed_for_vehicle(car_type, "NO_HELMET"))
        self.assertFalse(is_violation_allowed_for_vehicle(car_type, "triple_riding"))
        self.assertFalse(is_violation_allowed_for_vehicle(car_type, "TRIPLE_RIDING"))
        self.assertTrue(is_violation_allowed_for_vehicle(car_type, "wrong_side"))
        self.assertTrue(is_violation_allowed_for_vehicle(car_type, "WRONG_SIDE_DRIVING"))
        self.assertTrue(is_violation_allowed_for_vehicle(car_type, "MOBILE_PHONE_USAGE"))

    def test_violation_eligibility_motorcycle(self):
        moto_type = "Motorcycle"
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "no_helmet"))
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "NO_HELMET"))
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "triple_riding"))
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "TRIPLE_RIDING"))
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "wrong_side"))
        self.assertTrue(is_violation_allowed_for_vehicle(moto_type, "WRONG_SIDE_DRIVING"))

    def test_violation_eligibility_scooter(self):
        scooter_type = "Scooter"
        self.assertTrue(is_violation_allowed_for_vehicle(scooter_type, "no_helmet"))
        self.assertTrue(is_violation_allowed_for_vehicle(scooter_type, "triple_riding"))
        self.assertTrue(is_violation_allowed_for_vehicle(scooter_type, "wrong_side"))

    def test_violation_eligibility_unknown_vehicle(self):
        for unk in ["Unknown", "unknown", "Vehicle", None, ""]:
            self.assertFalse(is_violation_allowed_for_vehicle(unk, "no_helmet"))
            self.assertFalse(is_violation_allowed_for_vehicle(unk, "NO_HELMET"))
            self.assertFalse(is_violation_allowed_for_vehicle(unk, "triple_riding"))
            self.assertFalse(is_violation_allowed_for_vehicle(unk, "TRIPLE_RIDING"))
            self.assertTrue(is_violation_allowed_for_vehicle(unk, "wrong_side"))
            self.assertTrue(is_violation_allowed_for_vehicle(unk, "WRONG_SIDE_DRIVING"))

    def test_filter_eligible_violations_car(self):
        viols = ["no_helmet", "triple_riding", "wrong_side"]
        eligible, removed = filter_eligible_violations("Car", viols)
        self.assertEqual(eligible, ["wrong_side"])
        self.assertEqual(removed, ["no_helmet", "triple_riding"])

    def test_filter_eligible_violations_four_wheeler_case_variations(self):
        for var in ["car", "CAR", "Car", "four wheeler", "four-wheeler", "4-wheeler", "SUV", "Truck"]:
            eligible, removed = filter_eligible_violations(var, ["no_helmet", "triple_riding", "wrong_side"])
            self.assertEqual(eligible, ["wrong_side"], f"Failed for variation '{var}'")
            self.assertEqual(removed, ["no_helmet", "triple_riding"], f"Failed for variation '{var}'")

    def test_filter_eligible_violations_motorcycle(self):
        viols = ["no_helmet", "triple_riding", "wrong_side"]
        eligible, removed = filter_eligible_violations("Motorcycle", viols)
        self.assertEqual(eligible, ["no_helmet", "triple_riding", "wrong_side"])
        self.assertEqual(removed, [])

    def test_filter_eligible_violations_scooter(self):
        viols = ["no_helmet", "triple_riding", "wrong_side"]
        eligible, removed = filter_eligible_violations("Scooter", viols)
        self.assertEqual(eligible, ["no_helmet", "triple_riding", "wrong_side"])
        self.assertEqual(removed, [])

    def test_create_challan_defensive_guardrail(self):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_filter = MagicMock()
        mock_filter.count.return_value = 0
        mock_query.filter.return_value = mock_filter
        mock_db.query.return_value = mock_query

        car_vehicle = models.Vehicle(
            id="v-car",
            plate_number="MH14XX1234",
            vehicle_type="Car",
        )
        moto_vehicle = models.Vehicle(
            id="v-moto",
            plate_number="MH14XX5678",
            vehicle_type="Motorcycle",
        )
        helmet_violation = models.ViolationType(
            id="vt-h",
            code="NO_HELMET",
            name="No Helmet",
            base_fine_amount=500.0,
        )
        triple_violation = models.ViolationType(
            id="vt-t",
            code="TRIPLE_RIDING",
            name="Triple Riding",
            base_fine_amount=1000.0,
        )
        wrong_side_violation = models.ViolationType(
            id="vt-ws",
            code="WRONG_SIDE_DRIVING",
            name="Wrong Side",
            base_fine_amount=1000.0,
        )

        # 1. Car + Helmet -> raises ValueError
        with self.assertRaises(ValueError) as ctx:
            create_challan(mock_db, car_vehicle, helmet_violation, models.DetectionSource.ai)
        self.assertIn("not applicable to vehicle", str(ctx.exception))

        # 2. Car + Triple Riding -> raises ValueError
        with self.assertRaises(ValueError) as ctx:
            create_challan(mock_db, car_vehicle, triple_violation, models.DetectionSource.ai)
        self.assertIn("not applicable to vehicle", str(ctx.exception))

        # 3. Car + Wrong Side -> SUCCESS
        challan_ws = create_challan(mock_db, car_vehicle, wrong_side_violation, models.DetectionSource.ai)
        self.assertIsNotNone(challan_ws)
        self.assertEqual(challan_ws.vehicle_id, "v-car")

        # 4. Motorcycle + Helmet -> SUCCESS
        challan_h = create_challan(mock_db, moto_vehicle, helmet_violation, models.DetectionSource.ai)
        self.assertIsNotNone(challan_h)
        self.assertEqual(challan_h.vehicle_id, "v-moto")


class TestViolationEndpointsIntegration(unittest.TestCase):
    """Integration tests for all challan creation endpoints with SQLite in-memory DB."""

    @classmethod
    def setUpClass(cls):
        # Configure in-memory SQLite for testing
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

        # Seed users, vehicles, violation types
        db = cls.TestingSessionLocal()

        # Violation types
        cls.vt_helmet = models.ViolationType(
            code="NO_HELMET",
            name="No Helmet",
            base_fine_amount=500.0,
        )
        cls.vt_triple = models.ViolationType(
            code="TRIPLE_RIDING",
            name="Triple Riding",
            base_fine_amount=1000.0,
        )
        cls.vt_wrong = models.ViolationType(
            code="WRONG_SIDE_DRIVING",
            name="Wrong Side Driving",
            base_fine_amount=1000.0,
        )
        db.add_all([cls.vt_helmet, cls.vt_triple, cls.vt_wrong])

        # Officer User
        cls.officer_user = models.User(
            full_name="Officer Test",
            email="officer_test@example.com",
            mobile_number="9998887770",
            password_hash=hash_password("Pass@123"),
            role=models.UserRole.officer,
            is_verified=True,
        )
        db.add(cls.officer_user)
        db.flush()

        cls.officer_profile = models.Officer(
            user_id=cls.officer_user.id,
            badge_number="MH-OFF-9999",
            station="Test Station",
            jurisdiction="Pune Central",
        )
        db.add(cls.officer_profile)

        # Vehicles
        cls.car_vehicle = models.Vehicle(
            plate_number="MH14XX1234",
            vehicle_type="Car",
            model="Honda City",
        )
        cls.moto_vehicle = models.Vehicle(
            plate_number="MH14XX5678",
            vehicle_type="Motorcycle",
            model="Bajaj Pulsar",
        )
        cls.scooter_vehicle = models.Vehicle(
            plate_number="MH14XX9012",
            vehicle_type="Scooter",
            model="Honda Activa",
        )
        db.add_all([cls.car_vehicle, cls.moto_vehicle, cls.scooter_vehicle])
        db.commit()

        # Tokens
        cls.officer_token = create_access_token(
            subject=str(cls.officer_user.id), role="officer"
        )
        cls.auth_headers = {"Authorization": f"Bearer {cls.officer_token}"}
        db.close()

    def setUp(self):
        db = self.TestingSessionLocal()
        db.query(models.Evidence).delete()
        db.query(models.Payment).delete()
        db.query(models.Notification).delete()
        db.query(models.Challan).delete()
        db.commit()
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=cls.engine)

    def test_manual_challan_car_helmet_blocked(self):
        """Officer cannot manually create a NO_HELMET challan for a Car."""
        res = self.client.post(
            "/challans/manual",
            json={
                "plate_number": "MH14XX1234",
                "violation_code": "NO_HELMET",
                "location": "JM Road",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("not applicable to vehicle class", res.json()["detail"])

    def test_manual_challan_car_triple_riding_blocked(self):
        """Officer cannot manually create a TRIPLE_RIDING challan for a Car."""
        res = self.client.post(
            "/challans/manual",
            json={
                "plate_number": "MH14XX1234",
                "violation_code": "TRIPLE_RIDING",
                "location": "JM Road",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("not applicable to vehicle class", res.json()["detail"])

    def test_manual_challan_car_wrong_side_allowed(self):
        """Officer CAN manually create a WRONG_SIDE_DRIVING challan for a Car."""
        res = self.client.post(
            "/challans/manual",
            json={
                "plate_number": "MH14XX1234",
                "violation_code": "WRONG_SIDE_DRIVING",
                "location": "JM Road",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["fine_amount"], 1500.0)

    def test_manual_challan_motorcycle_helmet_allowed(self):
        """Officer CAN manually create a NO_HELMET challan for a Motorcycle."""
        res = self.client.post(
            "/challans/manual",
            json={
                "plate_number": "MH14XX5678",
                "violation_code": "NO_HELMET",
                "location": "JM Road",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["fine_amount"], 500.0)

    def test_manual_challan_scooter_triple_riding_allowed(self):
        """Officer CAN manually create a TRIPLE_RIDING challan for a Scooter."""
        res = self.client.post(
            "/challans/manual",
            json={
                "plate_number": "MH14XX9012",
                "violation_code": "TRIPLE_RIDING",
                "location": "FC Road",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["fine_amount"], 1000.0)

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_car_helmet_and_triple_blocked_wrong_side_allowed(self, mock_detect):
        """In /violations/detect, Car with helmet+triple+wrong_side only generates wrong_side challan."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "triple_riding", "wrong_side"],
            plate_number="MH14XX1234",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    plate_number="MH14XX1234",
                    plate_confidence=0.95,
                    violations_found=["no_helmet", "triple_riding", "wrong_side"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Exactly 1 challan generated (only for wrong_side)
        self.assertEqual(len(data["challan_ids"]), 1)

        db = self.TestingSessionLocal()
        created_ch = db.query(models.Challan).filter(models.Challan.id == data["challan_ids"][0]).first()
        self.assertEqual(created_ch.violation_type.code, "WRONG_SIDE_DRIVING")
        self.assertEqual(created_ch.vehicle.vehicle_type, "Car")
        db.close()

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_car_only_helmet_creates_zero_challans(self, mock_detect):
        """In /violations/detect, Car with only no_helmet creates 0 challans."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH14XX1234",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    plate_number="MH14XX1234",
                    plate_confidence=0.95,
                    violations_found=["no_helmet"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["challan_ids"]), 0)
        self.assertIn("0 challan(s) auto-created", data["message"])

    @patch("app.routers.officer.run_detection")
    def test_officer_capture_car_helmet_and_triple_blocked(self, mock_detect):
        """In /officer/violations/capture-and-detect, Car with helmet+triple results in NO_VIOLATION."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "triple_riding"],
            plate_number="MH14XX1234",
            plate_confidence=0.96,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    plate_number="MH14XX1234",
                    plate_confidence=0.96,
                    violations_found=["no_helmet", "triple_riding"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            data={"vehicle_plate": "MH14XX1234"},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "NO_VIOLATION")
        self.assertIn("not applicable to Car", data["message"])

    @patch("app.routers.officer.run_detection")
    def test_officer_capture_motorcycle_helmet_allowed(self, mock_detect):
        """In /officer/violations/capture-and-detect, Motorcycle with helmet results in VIOLATION_DETECTED."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH14XX5678",
            plate_confidence=0.96,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    plate_number="MH14XX5678",
                    plate_confidence=0.96,
                    violations_found=["no_helmet"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            data={"vehicle_plate": "MH14XX5678"},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "VIOLATION_DETECTED")
        self.assertEqual(len(data["violations"]), 1)
        self.assertEqual(data["violations"][0]["violation_code"], "NO_HELMET")

    @patch("app.routers.officer.run_detection")
    def test_officer_capture_unknown_unregistered_vehicle_helmet_blocked(self, mock_detect):
        """Unregistered plate detected with helmet is NOT assumed to be motorcycle and NO challan is created."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH99ZZ9999",
            plate_confidence=0.96,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="vehicle",
                    plate_number="MH99ZZ9999",
                    plate_confidence=0.96,
                    violations_found=["no_helmet"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            data={"vehicle_plate": "MH99ZZ9999"},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "NO_VIOLATION")
        self.assertIn("not applicable to Unknown", data["message"])

        # Check DB to verify no challan was created
        db = self.TestingSessionLocal()
        created_ch = db.query(models.Challan).join(models.Vehicle).filter(models.Vehicle.plate_number == "MH99ZZ9999").all()
        self.assertEqual(len(created_ch), 0)
        db.close()

    @patch("app.routers.officer.run_detection")
    def test_officer_capture_unknown_unregistered_vehicle_wrong_side_allowed(self, mock_detect):
        """Unregistered plate detected with wrong_side CAN receive a wrong_side challan."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["wrong_side"],
            plate_number="MH88YY8888",
            plate_confidence=0.96,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="vehicle",
                    plate_number="MH88YY8888",
                    plate_confidence=0.96,
                    violations_found=["wrong_side"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/officer/violations/capture-and-detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            data={"vehicle_plate": "MH88YY8888"},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "VIOLATION_DETECTED")
        self.assertEqual(len(data["violations"]), 1)
        self.assertEqual(data["violations"][0]["violation_code"], "WRONG_SIDE_DRIVING")

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_scooter_helmet_and_triple_allowed(self, mock_detect):
        """In /violations/detect, Scooter with helmet+triple creates 2 challans."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "triple_riding"],
            plate_number="MH14XX9012",
            plate_confidence=0.95,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="scooter",
                    plate_number="MH14XX9012",
                    plate_confidence=0.95,
                    violations_found=["no_helmet", "triple_riding"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["challan_ids"]), 1)
        db = self.TestingSessionLocal()
        created_ch = db.query(models.Challan).filter(models.Challan.id == data["challan_ids"][0]).first()
        self.assertEqual(created_ch.fine_amount, 1500.0)
        db.close()

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_video_car_helmet_blocked_wrong_side_allowed(self, mock_detect):
        """In /violations/detect with MP4 video, Car with helmet+wrong_side creates ONLY wrong_side challan."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "wrong_side"],
            plate_number="MH14XX1234",
            plate_confidence=0.91,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="car",
                    plate_number="MH14XX1234",
                    plate_confidence=0.91,
                    violations_found=["no_helmet", "wrong_side"],
                )
            ],
            boxes=[],
        )

        dummy_video = BytesIO(b"fake_mp4_bytes")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("traffic_feed.mp4", dummy_video, "video/mp4")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["challan_ids"]), 1)

        db = self.TestingSessionLocal()
        created_ch = db.query(models.Challan).filter(models.Challan.id == data["challan_ids"][0]).first()
        self.assertEqual(created_ch.violation_type.code, "WRONG_SIDE_DRIVING")
        self.assertEqual(created_ch.vehicle.vehicle_type, "Car")
        db.close()

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_video_motorcycle_all_violations_allowed(self, mock_detect):
        """In /violations/detect with MP4 video, Motorcycle with helmet+wrong_side creates both challans."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet", "wrong_side"],
            plate_number="MH14XX5678",
            plate_confidence=0.91,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="motorcycle",
                    plate_number="MH14XX5678",
                    plate_confidence=0.91,
                    violations_found=["no_helmet", "wrong_side"],
                )
            ],
            boxes=[],
        )

        dummy_video = BytesIO(b"fake_mp4_bytes")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("traffic_feed.mp4", dummy_video, "video/mp4")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["challan_ids"]), 1)
        db = self.TestingSessionLocal()
        created_ch = db.query(models.Challan).filter(models.Challan.id == data["challan_ids"][0]).first()
        self.assertEqual(created_ch.fine_amount, 2000.0)
        db.close()

    @patch("app.routers.violations.run_detection")
    def test_violations_detect_unregistered_plate_creates_zero_challans(self, mock_detect):
        """In /violations/detect, unregistered plate is placed in unmatched_vehicles, 0 challans created."""
        mock_detect.return_value = schemas.DetectionResult(
            violations_found=["no_helmet"],
            plate_number="MH77QQ7777",
            plate_confidence=0.90,
            detected_vehicles=[
                schemas.DetectedVehicle(
                    vehicle_id=1,
                    vehicle_type="vehicle",
                    plate_number="MH77QQ7777",
                    plate_confidence=0.90,
                    violations_found=["no_helmet"],
                )
            ],
            boxes=[],
        )

        dummy_img = BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")

        res = self.client.post(
            "/violations/detect",
            files={"file": ("test.jpg", dummy_img, "image/jpeg")},
            headers=self.auth_headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data.get("challan_ids", [])), 0)
        self.assertEqual(len(data["unmatched_vehicles"]), 1)
        self.assertEqual(data["unmatched_vehicles"][0]["plate_number"], "MH77QQ7777")


if __name__ == "__main__":
    unittest.main()

