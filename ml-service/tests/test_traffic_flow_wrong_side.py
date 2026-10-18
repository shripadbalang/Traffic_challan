import os
import sys
import unittest
import numpy as np

ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

from app.detect import _VehicleMotionTracker, process_image


class TestTrafficFlowWrongSide(unittest.TestCase):
    def test_motion_tracker_opposite_flow_detection(self):
        """
        Verify that in a video sequence with multiple vehicles moving in a dominant direction,
        any vehicle moving opposite to that flow is flagged as wrong-side driving.
        """
        tracker = _VehicleMotionTracker(max_missing_frames=5)

        # Simulate 10 frames:
        # Vehicles 1, 2, 3 move downwards (y increases: +15 px per frame, flow: [0, 1])
        # Vehicle 4 moves upwards (y decreases: -15 px per frame, opposing flow: [0, -1])
        for f in range(10):
            frame_vehicles = [
                {
                    "vehicle_type": "car",
                    "bbox": [100.0, 100.0 + f * 15.0, 160.0, 170.0 + f * 15.0],
                    "plate_number": "KA01AB1111",
                    "plate_confidence": 0.95,
                    "violations_found": [],
                },
                {
                    "vehicle_type": "motorcycle",
                    "bbox": [220.0, 120.0 + f * 14.0, 270.0, 180.0 + f * 14.0],
                    "plate_number": "KA01AB2222",
                    "plate_confidence": 0.90,
                    "violations_found": [],
                },
                {
                    "vehicle_type": "bus",
                    "bbox": [320.0, 80.0 + f * 16.0, 420.0, 200.0 + f * 16.0],
                    "plate_number": "KA01AB3333",
                    "plate_confidence": 0.88,
                    "violations_found": [],
                },
                # Opposing vehicle (wrong side driving)
                {
                    "vehicle_type": "motorcycle",
                    "bbox": [20.0, 400.0 - f * 15.0, 70.0, 460.0 - f * 15.0],
                    "plate_number": "KA01WS9999",
                    "plate_confidence": 0.92,
                    "violations_found": [],
                },
            ]
            tracker.update(frame_idx=f + 1, detected_vehicles=frame_vehicles)

        res = tracker.analyze_traffic_flow()
        flow_vec = res["dominant_flow_vector"]
        wrong_side_tracks = res["wrong_side_tracks"]

        self.assertIsNotNone(flow_vec)
        # Dominant flow should be predominantly downward (flow_uy ~ 1.0)
        self.assertGreater(flow_vec[1], 0.7)

        # Vehicle 4 should be flagged as wrong-side
        self.assertEqual(len(wrong_side_tracks), 1)
        ws_trk = wrong_side_tracks[0]
        self.assertEqual(ws_trk["plate_number"], "KA01WS9999")
        self.assertIn("wrong_side", ws_trk["violations_found"])
        self.assertIn("Opposite traffic flow", ws_trk.get("wrong_side_reason", ""))

    def test_motion_tracker_no_false_positives_when_all_move_together(self):
        """
        Verify that when all vehicles move in the same direction, no wrong-side violation is flagged.
        """
        tracker = _VehicleMotionTracker(max_missing_frames=5)

        for f in range(8):
            frame_vehicles = [
                {
                    "vehicle_type": "car",
                    "bbox": [100.0, 100.0 + f * 10.0, 160.0, 160.0 + f * 10.0],
                    "plate_number": "KA01AB1111",
                    "plate_confidence": 0.95,
                    "violations_found": [],
                },
                {
                    "vehicle_type": "motorcycle",
                    "bbox": [200.0, 120.0 + f * 12.0, 250.0, 170.0 + f * 12.0],
                    "plate_number": "KA01AB2222",
                    "plate_confidence": 0.90,
                    "violations_found": [],
                },
            ]
            tracker.update(frame_idx=f + 1, detected_vehicles=frame_vehicles)

        res = tracker.analyze_traffic_flow()
        self.assertEqual(len(res["wrong_side_tracks"]), 0)

    def test_sample_12_jpg_wrong_side_detection(self):
        """
        Verify that 12.jpg (motorcycle traveling oncoming against dominant outgoing traffic stream)
        is correctly detected as wrong_side.
        """
        sample_path = os.path.abspath(os.path.join(ml_service_dir, "..", "test-assets", "samples", "12.jpg"))
        if not os.path.exists(sample_path):
            self.skipTest(f"Sample file {sample_path} not found")

        with open(sample_path, "rb") as f:
            res = process_image(f.read())

        self.assertIn("wrong_side", res["violations_found"])
        # Check that the violating vehicle has wrong_side in its violations_found
        ws_vehicles = [v for v in res["detected_vehicles"] if "wrong_side" in v.get("violations_found", [])]
        self.assertGreaterEqual(len(ws_vehicles), 1)


if __name__ == "__main__":
    unittest.main()
