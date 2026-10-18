import base64
import logging
from typing import Optional, Tuple

import httpx

from app.open_lpr.parser import (
    OpenLPRResult,
    parse_service_response,
    parse_vlm_json_response,
)

logger = logging.getLogger(__name__)

# Prompt templates from faisalthaheem/open-lpr
OPEN_LPR_PROMPT = """Perform OCR on the attached image and respond with a JSON document with the following structure. Analyze the actual image content and provide real detection results. DO NOT copy example data - analyze the image and provide actual results.

{
    "filename": "traffic_frame.jpg",
    "detections": [
        {
            "plate": {
                "confidence": 0.95,
                "coordinates": {
                    "x1": 100,
                    "y1": 200,
                    "x2": 400,
                    "y2": 300
                }
            },
            "ocr": [
                {
                    "text": "MH12AB1234",
                    "confidence": 0.95,
                    "coordinates": {
                        "x1": 120,
                        "y1": 220,
                        "x2": 380,
                        "y2": 280
                    }
                }
            ]
        }
    ]
}

IMPORTANT INSTRUCTIONS:
1. Analyze the ACTUAL image provided.
2. Detect ALL license plates in the image.
3. Extract the ACTUAL alphanumeric registration text from each license plate.
4. Coordinates must be normalized in the 0-1000 range.
5. If no license plates are found, return an empty detections array: "detections": []
"""


class OpenLPRClient:
    """
    Client for Open-LPR license plate detection & OCR.
    Supports both Open-LPR REST Service mode and direct Vision-Language Model mode.
    """

    def __init__(
        self,
        mode: str = "service",
        api_url: str = "http://open-lpr:8000/api/v1/ocr/",
        vlm_base_url: str = "",
        vlm_api_key: str = "",
        vlm_model: str = "qwen2-vl-7b-instruct",
        timeout: float = 12.0,
    ):
        self.mode = mode.lower()
        self.api_url = api_url.rstrip("/")
        if not self.api_url.endswith("/ocr") and not self.api_url.endswith("/ocr/"):
            if not self.api_url.endswith("/api/v1"):
                self.api_url = f"{self.api_url}/api/v1/ocr/"
            else:
                self.api_url = f"{self.api_url}/ocr/"
        else:
            if not self.api_url.endswith("/"):
                self.api_url = f"{self.api_url}/"

        self.vlm_base_url = vlm_base_url.rstrip("/")
        self.vlm_api_key = vlm_api_key or "none"
        self.vlm_model = vlm_model
        self.timeout = timeout
        self._service_unreachable_until = 0.0

    def detect(
        self,
        image_bytes: bytes,
        image_shape: Optional[Tuple[int, int]] = None,
    ) -> Optional[OpenLPRResult]:
        """
        Synchronously detect and recognize license plate from image bytes.

        Args:
            image_bytes: Raw JPEG/PNG image bytes.
            image_shape: Optional (height, width) tuple of the image.

        Returns:
            OpenLPRResult or None if detection fails or times out.
        """
        if not image_bytes:
            return None

        img_h, img_w = (image_shape if image_shape else (1080, 1920))

        if self.mode == "vlm" and self.vlm_base_url:
            return self._detect_via_vlm(image_bytes, img_w, img_h)
        return self._detect_via_service(image_bytes, img_w, img_h)

    def _detect_via_service(
        self,
        image_bytes: bytes,
        img_w: int,
        img_h: int,
    ) -> Optional[OpenLPRResult]:
        """Call Open-LPR microservice REST endpoint (POST /api/v1/ocr/)."""
        import time
        now = time.time()
        if now < self._service_unreachable_until:
            return None

        try:
            files = {"image": ("frame.jpg", image_bytes, "image/jpeg")}
            data = {"save_image": "false"}  # don't unnecessarily persist frames in Open-LPR DB
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(self.api_url, files=files, data=data)
                if resp.status_code == 200:
                    payload = resp.json()
                    return parse_service_response(payload, image_w=img_w, image_h=img_h)
                else:
                    logger.warning(
                        f"[Open-LPR] Service returned status {resp.status_code}: {resp.text[:200]}"
                    )
                    return None
        except httpx.RequestError as exc:
            logger.warning(f"[Open-LPR] Service unreachable at {self.api_url}: {exc}")
            self._service_unreachable_until = now + 60.0
            return None
        except Exception as exc:
            logger.error(f"[Open-LPR] Unexpected error during service call: {exc}")
            return None

    def _detect_via_vlm(
        self,
        image_bytes: bytes,
        img_w: int,
        img_h: int,
    ) -> Optional[OpenLPRResult]:
        """Call direct OpenAI-compatible Vision API (e.g. Qwen2-VL / Ollama / llama.cpp)."""
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            url = f"{self.vlm_base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.vlm_api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.vlm_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"},
                            },
                            {"type": "text", "text": OPEN_LPR_PROMPT},
                        ],
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            }
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return parse_vlm_json_response(content, image_w=img_w, image_h=img_h)
                else:
                    logger.warning(f"[Open-LPR VLM] Status {resp.status_code}: {resp.text[:200]}")
                    return None
        except Exception as exc:
            logger.error(f"[Open-LPR VLM] Request failed: {exc}")
            return None

    async def detect_async(
        self,
        image_bytes: bytes,
        image_shape: Optional[Tuple[int, int]] = None,
    ) -> Optional[OpenLPRResult]:
        """Asynchronous plate detection method."""
        img_h, img_w = (image_shape if image_shape else (1080, 1920))
        if self.mode == "vlm" and self.vlm_base_url:
            return self._detect_via_vlm(image_bytes, img_w, img_h)

        try:
            files = {"image": ("frame.jpg", image_bytes, "image/jpeg")}
            data = {"save_image": "false"}
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.api_url, files=files, data=data)
                if resp.status_code == 200:
                    payload = resp.json()
                    return parse_service_response(payload, image_w=img_w, image_h=img_h)
                return None
        except Exception as exc:
            logger.warning(f"[Open-LPR async] Service request failed: {exc}")
            return None

    def health_check(self) -> bool:
        """Check if Open-LPR service or VLM endpoint is reachable."""
        try:
            target = f"{self.api_url.rsplit('/api/', 1)[0]}/health" if "/api/" in self.api_url else self.api_url
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(target)
                return resp.status_code < 500
        except Exception:
            return False
