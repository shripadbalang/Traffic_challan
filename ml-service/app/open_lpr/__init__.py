"""
Open-LPR integration package for AI Traffic E-Challan.
Provides Vision-Language Model based Automatic License Plate Recognition.
"""

from app.open_lpr.client import OpenLPRClient
from app.open_lpr.parser import (
    OpenLPRResult,
    clean_text,
    normalize_plate_text,
    looks_like_indian_plate,
    convert_from_qwen2vl_format,
    parse_service_response,
    parse_vlm_json_response,
)

__all__ = [
    "OpenLPRClient",
    "OpenLPRResult",
    "clean_text",
    "normalize_plate_text",
    "looks_like_indian_plate",
    "convert_from_qwen2vl_format",
    "parse_service_response",
    "parse_vlm_json_response",
]
