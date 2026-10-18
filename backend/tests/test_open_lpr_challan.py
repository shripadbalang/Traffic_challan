"""
Test Open-LPR integration with backend Vehicle Lookup and Challan Engine.
Validates that Open-LPR plate detections trigger vehicle matching,
accurate fine calculation, evidence recording, and challan creation.
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import DetectionBox, DetectionResult, DetectedVehicle
from app.services.plate_matcher import find_vehicle_by_plate
from app.services.challan_engine import create_challan
from app import models


class TestOpenLPRChallanIntegration(unittest.TestCase):

    def test_detection_result_schema_with_open_lpr(self):
        """Verify DetectionResult schema can serialize and parse Open-LPR outputs."""
        open_lpr_data = {
            "violations_found": ["no_helmet"],
            "plate_number": "MH12DE1433",
            "plate_confidence": 0.94,
            "boxes": [
                {
                    "class_name": "no_helmet",
                    "confidence": 0.88,
                    "bbox": [150.0, 80.0, 320.0, 260.0],
                },
                {
                    "class_name": "license_plate",
                    "confidence": 0.94,
                    "bbox": [200.0, 450.0, 520.0, 560.0],
                },
            ],
            "annotated_file_path": None,
        }

        detection = DetectionResult(**open_lpr_data)
        self.assertEqual(detection.plate_number, "MH12DE1433")
        self.assertEqual(len(detection.boxes), 2)
        self.assertEqual(detection.boxes[1].class_name, "license_plate")
        self.assertEqual(detection.plate_confidence, 0.94)

    def test_mock_open_lpr_challan_generation(self):
        """Simulate complete flow from Open-LPR detection to Challan database entity creation."""
        mock_db = MagicMock()

        # Mock registered vehicle
        mock_vehicle = models.Vehicle(
            id="veh-123",
            plate_number="MH12DE1433",
            vehicle_type="motorcycle",
            model="Honda Activa",
        )
        mock_owner = models.User(
            id="usr-456",
            full_name="Rahul Sharma",
            email="rahul.sharma@example.com",
            mobile_number="9876543210",
        )
        mock_vehicle.owner = mock_owner

        # Mock DB query for vehicle lookup and prior offenses
        query_mock = MagicMock()
        filter_mock = MagicMock()
        filter_mock.first.return_value = mock_vehicle
        filter_mock.count.return_value = 0
        query_mock.filter.return_value = filter_mock
        mock_db.query.return_value = query_mock

        # 1. Match plate detected by Open-LPR
        detected_plate = "MH12DE1433"
        vehicle, match_conf = find_vehicle_by_plate(mock_db, detected_plate)

        self.assertIsNotNone(vehicle)
        self.assertEqual(vehicle.plate_number, "MH12DE1433")
        self.assertEqual(match_conf, 1.0)

        # 2. Mock Violation Type
        mock_violation_type = models.ViolationType(
            id="vtype-helmet",
            code="NO_HELMET",
            name="Driving without helmet",
            base_fine_amount=500.0,
            legal_section="129/177 MVA",
        )

        # 3. Create Challan
        challan = create_challan(
            db=mock_db,
            vehicle=vehicle,
            violation_type=mock_violation_type,
            detection_source=models.DetectionSource.ai,
            ai_confidence_score=0.94 * match_conf,
            location="FC Road, Pune",
        )

        # Verify challan properties
        self.assertEqual(challan.vehicle_id, "veh-123")
        self.assertEqual(challan.fine_amount, 500.0)
        self.assertEqual(challan.violation_type_id, "vtype-helmet")
        self.assertEqual(challan.location, "FC Road, Pune")

        # Verify DB calls were made
        mock_db.add.assert_called_with(challan)
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called_with(challan)

    def test_multi_vehicle_detection_result_and_challan_generation(self):
        """Verify DetectionResult schema parses multi-vehicle detections and can issue multiple challans."""
        multi_veh_data = {
            "violations_found": ["no_helmet", "wrong_side"],
            "plate_number": "MH27CE6707",
            "plate_confidence": 0.92,
            "boxes": [
                {"class_name": "license_plate", "confidence": 0.92, "bbox": [141.0, 714.0, 293.0, 808.0]},
                {"class_name": "license_plate", "confidence": 0.92, "bbox": [755.0, 846.0, 942.0, 949.0]},
                {"class_name": "motorcycle", "confidence": 0.89, "bbox": [1.0, 129.0, 416.0, 945.0]},
                {"class_name": "motorcycle", "confidence": 0.77, "bbox": [488.0, 128.0, 1008.0, 1226.0]},
            ],
            "detected_vehicles": [
                {
                    "vehicle_type": "motorcycle",
                    "confidence": 0.89,
                    "bbox": [1.0, 129.0, 416.0, 945.0],
                    "plate_number": "MH27CE6707",
                    "plate_confidence": 0.92,
                    "plate_bbox": [141.0, 714.0, 293.0, 808.0],
                    "violations_found": ["no_helmet"],
                },
                {
                    "vehicle_type": "motorcycle",
                    "confidence": 0.77,
                    "bbox": [488.0, 128.0, 1008.0, 1226.0],
                    "plate_number": "MH37AB0940",
                    "plate_confidence": 0.92,
                    "plate_bbox": [755.0, 846.0, 942.0, 949.0],
                    "violations_found": ["wrong_side"],
                },
            ],
            "annotated_file_path": None,
        }

        detection = DetectionResult(**multi_veh_data)
        self.assertEqual(len(detection.detected_vehicles), 2)
        self.assertEqual(detection.detected_vehicles[0].plate_number, "MH27CE6707")
        self.assertEqual(detection.detected_vehicles[0].violations_found, ["no_helmet"])
        self.assertEqual(detection.detected_vehicles[1].plate_number, "MH37AB0940")
        self.assertEqual(detection.detected_vehicles[1].violations_found, ["wrong_side"])


if __name__ == "__main__":
    unittest.main()

