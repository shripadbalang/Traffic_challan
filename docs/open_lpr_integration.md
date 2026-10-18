# 🚗 Open-LPR Integration Guide

This guide describes how [faisalthaheem/open-lpr](https://github.com/faisalthaheem/open-lpr) is integrated into the **AI-Powered Traffic E-Challan System** to deliver high-precision Automatic License Plate Recognition (ALPR / ANPR) and automated challan generation.

---

## 1. Overview & Motivation

In automated traffic violation enforcement (such as helmet detection, wrong-side driving, and triple riding), accurately identifying vehicle license plates is critical. Traditional OCR systems (e.g., EasyOCR or Tesseract) frequently struggle with:
- Non-standard fonts and multi-line Indian High Security Registration Plates (HSRP).
- High angle skew and partial shadow/occlusions on moving motorcycles.
- Character ambiguities (such as `0` vs `O`, `1` vs `I`, `8` vs `B`).

**Open-LPR** solves this by leveraging Vision-Language Models (such as Qwen2-VL / Qwen3-VL) with structured OCR prompts and normalized coordinate mapping to detect license plates and recognize registration numbers with high accuracy.

---

## 2. Architecture & Data Flow

```
┌────────────────────────┐
│  Traffic Camera /      │
│  Officer Video Upload  │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  backend (:8000)       │
│  POST /violations/detect
└───────────┬────────────┘
            │ Multipart bytes
            ▼
┌────────────────────────────────────────────────────────┐
│  ml-service (:8001) - process_image()                  │
│                                                        │
│  1. Violation Models:                                  │
│     - Helmet violation (helmet_best.pt)                │
│     - Wrong side driving (wrong_side_best.pt)          │
│     - Triple riding (yolo11n.pt person/bike IOU)       │
│                                                        │
│  2. Plate Detection & OCR Engine:                      │
│     ┌──────────────────────────────────────────────┐   │
│     │ [Primary] Open-LPR Client                    │   │
│     │   ├── Mode A: Open-LPR Service (POST /ocr/)  │   │
│     │   └── Mode B: Direct Qwen-VL / OpenAI Vision │   │
│     └──────────────────────┬───────────────────────┘   │
│                            │                           │
│               [If offline or no plate]                 │
│                            ▼                           │
│     ┌──────────────────────────────────────────────┐   │
│     │ [Fallback] YOLO (numberplate_best.pt)        │   │
│     │            + Enhanced EasyOCR                │   │
│     └──────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼ Returns DetectionResult:
                            │ - violations_found: ["no_helmet"]
                            │ - plate_number: "MH12DE1433"
                            │ - plate_confidence: 0.94
                            │ - boxes: [...]
┌───────────────────────────┴────────────────────────────┐
│  backend (:8000)                                       │
│                                                        │
│  1. Vehicle Resolution (plate_matcher.py):             │
│     - Exact match lookup in PostgreSQL                 │
│     - Fuzzy match fallback with Levenshtein tolerance  │
│                                                        │
│  2. Automated Challan Issuance:                        │
│     - Penalty calculated from violation_types table    │
│     - Status set to "PENDING"                          │
│     - Evidence image & bounding boxes recorded         │
│     - Verification QR code & PDF receipt generated     │
│     - SMS / Email notification sent to vehicle owner   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Deployment Modes

### Mode 1: Standalone Open-LPR Container (Recommended for Docker Compose)

In this mode, `ml-service` communicates with the official Open-LPR microservice via REST:

```yaml
# docker-compose.yml
services:
  open-lpr:
    image: ghcr.io/faisalthaheem/open-lpr:latest
    container_name: echallan-open-lpr
    ports:
      - "8002:8000"
    environment:
      - QWEN_API_KEY=${QWEN_API_KEY:-}
      - QWEN_BASE_URL=${QWEN_BASE_URL:-https://ollama.computedsynergy.com/v1}
      - QWEN_MODEL=${QWEN_MODEL:-qwen3-vl-4b-instruct}
    networks:
      - echallan-network
```

Run with:
```bash
docker compose up -d
```

### Mode 2: Direct Vision-Language Model (VLM) Mode

If you already have a local or remote OpenAI-compatible Vision API (e.g., Ollama running `qwen2.5-vl`, vLLM, llama.cpp, or OpenAI Vision), configure `ml-service` to call it directly without needing the Django Open-LPR container:

In `.env`:
```ini
OPEN_LPR_ENABLED=true
OPEN_LPR_MODE=vlm
OPEN_LPR_VLM_BASE_URL=http://localhost:11434/v1
OPEN_LPR_VLM_API_KEY=your_optional_key
OPEN_LPR_VLM_MODEL=qwen2.5-vl:latest
```

### Mode 3: Automatic Resilient Fallback

If Open-LPR is unreachable, encounters network latency, or returns no plate:
- `ml-service` automatically logs the event and falls back to our local custom-trained YOLO `models/numberplate_best.pt` combined with EasyOCR.
- The pipeline never crashes or drops violation records due to an external network dependency.

---

## 4. Configuration Reference

All settings can be configured via environment variables or `.env`:

| Setting | Type | Default | Description |
|---|---|---|---|
| `OPEN_LPR_ENABLED` | `bool` | `true` | Enables/disables Open-LPR integration |
| `OPEN_LPR_MODE` | `str` | `"service"` | `"service"` (REST microservice) or `"vlm"` (Direct Vision API) |
| `OPEN_LPR_API_URL` | `str` | `http://open-lpr:8000/api/v1/ocr/` | Open-LPR REST service endpoint |
| `OPEN_LPR_VLM_BASE_URL` | `str` | `""` | Base URL for direct OpenAI-compatible Vision API |
| `OPEN_LPR_VLM_API_KEY` | `str` | `""` | API key for direct VLM endpoint |
| `OPEN_LPR_VLM_MODEL` | `str` | `"qwen2-vl-7b-instruct"` | Model identifier for VLM endpoint |
| `OPEN_LPR_TIMEOUT` | `float` | `12.0` | HTTP timeout in seconds |
| `OPEN_LPR_FALLBACK_TO_EASYOCR` | `bool` | `true` | Fallback to YOLO+EasyOCR if Open-LPR returns no plate |

---

## 5. Testing & Verification

### Run Open-LPR Unit & Integration Tests:
```bash
cd ml-service
python -m unittest tests/test_open_lpr.py
```

### Run End-to-End Automated Challan Generation Test:
```bash
cd backend
python tests/test_open_lpr_challan.py
```
