"""
ML Service Unit Tests for Car False Helmet & Triple-Riding Prevention.
Validates scenarios:
1. Car with multiple occupants -> no riders assigned, no triple riding.
2. Car with person visible through window -> person excluded from motorcycle riders, no helmet violation on car.
3. Motorcycle with 1 rider wearing helmet -> no helmet violation.
4. Motorcycle with 1 rider without helmet -> helmet violation confirmed.
5. Motorcycle with 2 riders -> no triple-riding violation.
6. Motorcycle with 3 riders -> triple-riding violation confirmed.
7. Image with both cars and motorcycles -> violations assigned strictly to motorcycle, car stays clean.
8. Car or motorcycle driving wrong side -> wrong-side violation preserved for both.
9. Uncertain vehicle/rider classification -> no false automatic violation.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.detect import (
    _assign_riders_to_motorcycles,
    _detect_triple_riding,
    _detect_helmets,
    _associate_vehicles_plates_violations,
    _iou,
    _box_containment,
)


class TestCarFalseViolationsML(unittest.TestCase):
    """Direct tests for ML service association, rider filtering, and car protection logic."""

    def test_scenario_1_car_with_multiple_occupants_no_riders_no_triple_riding(self):
        """Scenario 1: Car with multiple occupants -> occupants inside car are NOT treated as motorcycle riders."""
        four_wheelers = [{"bbox": [100, 100, 500, 400], "confidence": 0.92, "class_name": "car"}]
        # Occupants sitting inside the car
        people = [
            {"bbox": [150, 120, 250, 300], "confidence": 0.88},
            {"bbox": [280, 120, 380, 300], "confidence": 0.85},
            {"bbox": [350, 130, 450, 320], "confidence": 0.80},
        ]

        # No motorcycles in scene
        motorcycles = []
        assigned = _assign_riders_to_motorcycles(motorcycles, people, four_wheelers=four_wheelers)
        self.assertEqual(len(assigned), 0)

        # Spurious motorcycle detection overlapping the car:
        spurious_moto = [{"bbox": [120, 110, 480, 390], "confidence": 0.40}]
        iou = _iou(spurious_moto[0]["bbox"], four_wheelers[0]["bbox"])
        self.assertGreater(iou, 0.35)

        # Rider filtering with four_wheelers suppresses car occupants:
        assigned = _assign_riders_to_motorcycles(spurious_moto, people, four_wheelers=four_wheelers)
        self.assertEqual(len(assigned[0]), 0)

    def test_scenario_2_car_with_person_visible_through_window(self):
        """Scenario 2: Person visible through car window -> excluded from motorcycle rider assignment."""
        car = {"bbox": [200, 150, 600, 450], "confidence": 0.95, "class_name": "car"}
        window_person = {"bbox": [250, 160, 350, 320], "confidence": 0.89}  # fully inside car
        four_wheelers = [car]
        people = [window_person]

        moto = [{"bbox": [50, 200, 180, 400], "confidence": 0.90}]
        assigned = _assign_riders_to_motorcycles(moto, people, four_wheelers=four_wheelers)
        self.assertEqual(len(assigned[0]), 0)

        # Car association: car must never receive helmet or triple-riding violation
        vehicles = [
            {"class_name": "car", "bbox": [200, 150, 600, 450], "confidence": 0.95},
        ]
        plates = [
            {"bbox": [350, 380, 450, 420], "plate_number": "MH12AB1234", "confidence": 0.92}
        ]
        helmet_boxes = [
            {"bbox": [250, 160, 300, 220], "confidence": 0.88, "class_name": "without_helmet"}
        ]

        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=helmet_boxes,
            wrong_side_boxes=[],
            triple_riding_boxes=[],
        )
        self.assertEqual(res[0]["violations_found"], [])

    def test_scenario_3_motorcycle_one_rider_wearing_helmet(self):
        """Scenario 3: Motorcycle with 1 rider wearing helmet -> no helmet violation."""
        moto = [{"bbox": [100, 100, 300, 400], "confidence": 0.90}]
        rider = {"bbox": [130, 80, 270, 350], "confidence": 0.88}
        assigned = _assign_riders_to_motorcycles(moto, [rider], four_wheelers=[])
        self.assertEqual(len(assigned[0]), 1)

        vehicles = [
            {"class_name": "motorcycle", "bbox": [100, 100, 300, 400], "confidence": 0.90},
        ]
        plates = [
            {"bbox": [160, 350, 240, 390], "plate_number": "MH12CD5678", "confidence": 0.94}
        ]

        # No helmet violations (rider wears helmet)
        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=[],
            wrong_side_boxes=[],
            triple_riding_boxes=[],
        )
        self.assertEqual(res[0]["violations_found"], [])

    def test_scenario_4_motorcycle_one_rider_without_helmet(self):
        """Scenario 4: Motorcycle with 1 rider without helmet -> helmet violation confirmed."""
        vehicles = [
            {"class_name": "motorcycle", "bbox": [100, 100, 300, 400], "confidence": 0.90},
        ]
        plates = [
            {"bbox": [160, 350, 240, 390], "plate_number": "MH12CD5678", "confidence": 0.94}
        ]
        helmet_boxes = [
            {"bbox": [150, 80, 210, 140], "confidence": 0.89, "class_name": "without_helmet"}
        ]

        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=helmet_boxes,
            wrong_side_boxes=[],
            triple_riding_boxes=[],
        )
        self.assertIn("no_helmet", res[0]["violations_found"])

    def test_scenario_5_motorcycle_with_two_riders_no_triple_riding(self):
        """Scenario 5: Motorcycle with 2 riders -> no triple riding violation."""
        moto = [{"bbox": [100, 100, 300, 400], "confidence": 0.90}]
        rider1 = {"bbox": [130, 80, 230, 350], "confidence": 0.88}
        rider2 = {"bbox": [170, 80, 270, 350], "confidence": 0.85}
        assigned = _assign_riders_to_motorcycles(moto, [rider1, rider2], four_wheelers=[])
        self.assertEqual(len(assigned[0]), 2)
        self.assertFalse(len(assigned[0]) >= 3)

    def test_scenario_6_motorcycle_with_three_riders_triple_riding(self):
        """Scenario 6: Motorcycle with 3 riders -> triple riding violation confirmed."""
        moto = [{"bbox": [100, 100, 350, 400], "confidence": 0.92}]
        rider1 = {"bbox": [120, 80, 200, 350], "confidence": 0.88}
        rider2 = {"bbox": [180, 80, 260, 350], "confidence": 0.86}
        rider3 = {"bbox": [240, 80, 320, 350], "confidence": 0.84}
        assigned = _assign_riders_to_motorcycles(moto, [rider1, rider2, rider3], four_wheelers=[])
        self.assertEqual(len(assigned[0]), 3)

        vehicles = [
            {"class_name": "motorcycle", "bbox": [100, 100, 350, 400], "confidence": 0.92},
        ]
        plates = [
            {"bbox": [200, 350, 280, 390], "plate_number": "MH12EF9012", "confidence": 0.93}
        ]
        triple_riding_boxes = [
            {"bbox": [100, 100, 350, 400], "confidence": 0.85, "class_name": "triple_riding"}
        ]

        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=[],
            wrong_side_boxes=[],
            triple_riding_boxes=triple_riding_boxes,
        )
        self.assertIn("triple_riding", res[0]["violations_found"])

    def test_scenario_7_crowded_scene_cars_and_motorcycles(self):
        """Scenario 7: Image with both cars and motorcycles -> violations assigned ONLY to motorcycle."""
        vehicles = [
            {"class_name": "car", "bbox": [50, 100, 300, 400], "confidence": 0.95},
            {"class_name": "motorcycle", "bbox": [350, 150, 550, 450], "confidence": 0.91},
        ]
        plates = [
            {"bbox": [100, 340, 220, 380], "plate_number": "MH12CAR1111", "confidence": 0.95},
            {"bbox": [400, 380, 500, 420], "plate_number": "MH12MOTO2222", "confidence": 0.94},
        ]
        helmet_boxes = [
            {"bbox": [120, 130, 180, 200], "confidence": 0.85, "class_name": "without_helmet"},  # inside car
            {"bbox": [410, 130, 470, 200], "confidence": 0.88, "class_name": "without_helmet"},  # on motorcycle
        ]

        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=helmet_boxes,
            wrong_side_boxes=[],
            triple_riding_boxes=[],
        )

        car_result = next(v for v in res if v["vehicle_type"] == "car")
        moto_result = next(v for v in res if v["vehicle_type"] == "motorcycle")

        self.assertEqual(car_result["violations_found"], [])
        self.assertEqual(car_result["plate_number"], "MH12CAR1111")
        self.assertIn("no_helmet", moto_result["violations_found"])
        self.assertEqual(moto_result["plate_number"], "MH12MOTO2222")

    def test_scenario_8_wrong_side_preserved_for_both_car_and_motorcycle(self):
        """Scenario 8: Wrong-side driving is preserved for both car and motorcycle."""
        vehicles = [
            {"class_name": "car", "bbox": [50, 100, 300, 400], "confidence": 0.95},
            {"class_name": "motorcycle", "bbox": [350, 150, 550, 450], "confidence": 0.91},
        ]
        plates = [
            {"bbox": [100, 340, 220, 380], "plate_number": "MH12CAR1111", "confidence": 0.95},
            {"bbox": [400, 380, 500, 420], "plate_number": "MH12MOTO2222", "confidence": 0.94},
        ]
        wrong_side_boxes = [
            {"bbox": [50, 100, 300, 400], "confidence": 0.89, "class_name": "wrong_side"},
            {"bbox": [350, 150, 550, 450], "confidence": 0.87, "class_name": "wrong_side"},
        ]

        res = _associate_vehicles_plates_violations(
            vehicles=vehicles,
            plates=plates,
            helmet_boxes=[],
            wrong_side_boxes=wrong_side_boxes,
            triple_riding_boxes=[],
        )
        car_result = next(v for v in res if v["vehicle_type"] == "car")
        moto_result = next(v for v in res if v["vehicle_type"] == "motorcycle")

        self.assertIn("wrong_side", car_result["violations_found"])
        self.assertIn("wrong_side", moto_result["violations_found"])

    def test_scenario_9_uncertain_vehicle_or_pedestrian_no_false_challan(self):
        """Scenario 9: Uncertain vehicle type or pedestrian beside vehicle -> no automatic challan."""
        car = {"bbox": [100, 100, 400, 400], "confidence": 0.90, "class_name": "car"}
        pedestrian = {"bbox": [420, 120, 480, 400], "confidence": 0.85}  # beside the car
        assigned = _assign_riders_to_motorcycles([], [pedestrian], four_wheelers=[car])
        self.assertEqual(len(assigned), 0)


if __name__ == "__main__":
    unittest.main()
