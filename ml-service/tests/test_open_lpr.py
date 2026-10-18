import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure ml-service root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.open_lpr.parser import (
    clean_text,
    convert_from_qwen2vl_format,
    looks_like_indian_plate,
    normalize_plate_text,
    parse_service_response,
    parse_vlm_json_response,
)
from app.open_lpr.client import OpenLPRClient


class TestOpenLPRParser(unittest.TestCase):

    def test_clean_text(self):
        self.assertEqual(clean_text("mh-12 ab 1234"), "MH12AB1234")
        self.assertEqual(clean_text("DL.01.XYZ.9999"), "DL01XYZ9999")
        self.assertEqual(clean_text(""), "")
        self.assertEqual(clean_text(None), "")

    def test_normalize_plate_text(self):
        # 0 in state code should correct to O
        self.assertEqual(normalize_plate_text("0D12AB1234"), "OD12AB1234")
        # O in district code should correct to 0
        self.assertEqual(normalize_plate_text("MHIOAB1234"), "MH10AB1234")
        # Standard plate should remain intact
        self.assertEqual(normalize_plate_text("MH12DE1433"), "MH12DE1433")

    def test_looks_like_indian_plate(self):
        self.assertTrue(looks_like_indian_plate("MH12DE1433"))
        self.assertTrue(looks_like_indian_plate("DL04AB1234"))
        self.assertTrue(looks_like_indian_plate("KA03HA9999"))
        self.assertFalse(looks_like_indian_plate("NOTAPLATE"))
        self.assertFalse(looks_like_indian_plate("ZZ99AB1234"))  # Invalid state code ZZ
        self.assertFalse(looks_like_indian_plate("123456"))

    def test_convert_from_qwen2vl_format(self):
        # 0-1000 scale converted to 1920x1080
        raw_box = [100.0, 200.0, 400.0, 300.0]
        scaled = convert_from_qwen2vl_format(raw_box, original_w=1920, original_h=1080)
        self.assertEqual(scaled, [192, 216, 768, 324])

    def test_parse_service_response_success(self):
        mock_data = {
            "success": True,
            "image_id": 42,
            "results": {
                "detections": [
                    {
                        "plate_id": "plate1",
                        "plate": {
                            "confidence": 0.92,
                            "coordinates": {"x1": 150, "y1": 200, "x2": 450, "y2": 320},
                        },
                        "ocr": [
                            {
                                "text": "MH12DE1433",
                                "confidence": 0.95,
                                "coordinates": {"x1": 160, "y1": 210, "x2": 440, "y2": 310},
                            }
                        ],
                    }
                ]
            },
        }
        res = parse_service_response(mock_data, image_w=1920, image_h=1080)
        self.assertIsNotNone(res)
        self.assertEqual(res.plate_number, "MH12DE1433")
        self.assertEqual(res.bbox, [150, 200, 450, 320])
        self.assertTrue(res.is_valid_format)
        self.assertGreater(res.confidence, 0.8)

    def test_parse_service_response_empty(self):
        mock_data = {"success": True, "results": {"detections": []}}
        res = parse_service_response(mock_data)
        self.assertIsNone(res)

    def test_parse_vlm_json_response_with_markdown(self):
        vlm_output = """Here is the result:
```json
{
    "detections": [
        {
            "plate": {
                "confidence": 0.94,
                "coordinates": {"x1": 100, "y1": 200, "x2": 500, "y2": 400}
            },
            "ocr": [
                {
                    "text": "DL01AB9876",
                    "confidence": 0.96
                }
            ]
        }
    ]
}
```
"""
        res = parse_vlm_json_response(vlm_output, image_w=1000, image_h=1000)
        self.assertIsNotNone(res)
        self.assertEqual(res.plate_number, "DL01AB9876")
        self.assertEqual(res.bbox, [100, 200, 500, 400])
        self.assertTrue(res.is_valid_format)


class TestOpenLPRClient(unittest.TestCase):

    @patch("httpx.Client.post")
    def test_client_service_mode_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "results": {
                "detections": [
                    {
                        "plate": {
                            "confidence": 0.90,
                            "coordinates": {"x1": 100, "y1": 100, "x2": 300, "y2": 200},
                        },
                        "ocr": [
                            {"text": "MH14AZ5555", "confidence": 0.92}
                        ],
                    }
                ]
            },
        }
        mock_post.return_value = mock_resp

        client = OpenLPRClient(mode="service", api_url="http://fake-lpr:8000/api/v1/ocr/")
        res = client.detect(b"fake_jpeg_bytes", image_shape=(720, 1280))

        self.assertIsNotNone(res)
        self.assertEqual(res.plate_number, "MH14AZ5555")
        self.assertEqual(res.bbox, [100, 100, 300, 200])

    @patch("httpx.Client.post")
    def test_client_service_mode_network_failure(self, mock_post):
        import httpx
        mock_post.side_effect = httpx.RequestError("Connection refused")

        client = OpenLPRClient(mode="service", api_url="http://offline-lpr:8000/api/v1/ocr/")
        res = client.detect(b"fake_jpeg_bytes")

        # Must gracefully return None so fallback can proceed
        self.assertIsNone(res)


if __name__ == "__main__":
    unittest.main()
