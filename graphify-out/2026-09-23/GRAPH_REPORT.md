# Graph Report - Traffic_challan  (2026-09-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 414 nodes · 936 edges · 24 communities (11 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80183474`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- models.py
- detect.py
- os
- test_open_lpr.py
- schemas.py
- run_graphify.py
- payments.py
- User
- schema.sql
- overview
- backend/app/config.py
- backend/tests/__init__.py
- ml-service/tests/__init__.py
- BaseSettings
- post
- Session
- UploadFile
- BaseSettings
- Any
- ndarray

## God Nodes (most connected - your core abstractions)
1. `process_image()` - 18 edges
2. `OpenLPRClient` - 15 edges
3. `User` - 15 edges
4. `parse_service_response()` - 14 edges
5. `create_challan()` - 11 edges
6. `notify_challan_created()` - 11 edges
7. `parse_vlm_json_response()` - 11 edges
8. `OpenLPRResult` - 10 edges
9. `_ocr_plate()` - 10 edges
10. `_ocr_plate_fastplate()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `process_image()`  [EXTRACTED]
  scripts/test_single_image.py → ml-service/app/detect.py
- `get_open_lpr_client()` --calls--> `OpenLPRClient`  [INFERRED]
  ml-service/app/detect.py → ml-service/app/open_lpr/client.py
- `detect_violation()` --calls--> `create_challan()`  [INFERRED]
  backend/app/routers/violations.py → backend/app/services/challan_engine.py
- `detect_violation()` --calls--> `notify_challan_created()`  [INFERRED]
  backend/app/routers/violations.py → backend/app/services/notification_service.py
- `detect_violation()` --calls--> `find_vehicle_by_plate()`  [INFERRED]
  backend/app/routers/violations.py → backend/app/services/plate_matcher.py

## Import Cycles
- None detected.

## Communities (24 total, 13 thin omitted)

### Community 0 - "models.py"
Cohesion: 0.06
Nodes (68): app, app_config, app_core_security, app_services_ml_client, app_services_notification_service, create_access_token(), decode_token(), get_current_user() (+60 more)

### Community 1 - "detect.py"
Cohesion: 0.07
Nodes (66): Any, _annotate_frame_image(), _associate_vehicles_plates_violations(), _box_containment(), _build_reading_order_text(), _clean_text(), _cluster_plate_boxes(), _detect_triple_riding() (+58 more)

### Community 2 - "os"
Cohesion: 0.08
Nodes (22): cv2, dotenv, easyocr, fast_plate_ocr, glob, detect_wrong_side_smart(), Smart Wrong-Side Detection combining: 1. Vehicle & Rider Detection (YOLO11) 2.…, get_sample_path() (+14 more)

### Community 3 - "test_open_lpr.py"
Cohesion: 0.08
Nodes (31): base64, dataclasses, httpx, json, logging, OpenLPRClient, Call Open-LPR microservice REST endpoint (POST /api/v1/ocr/)., Call direct OpenAI-compatible Vision API (e.g. Qwen2-VL / Ollama / llama.cpp). (+23 more)

### Community 4 - "schemas.py"
Cohesion: 0.07
Nodes (42): app_services_challan_engine, app_services_plate_matcher, generate_otp(), Generates a 6-digit OTP. In this demo system OTPs are logged/emailed instead of…, citizen_signup(), login(), post, Session (+34 more)

### Community 5 - "run_graphify.py"
Cohesion: 0.14
Nodes (27): argparse, Namespace, Path, pathlib, cmd_build(), cmd_explain(), cmd_path(), cmd_query() (+19 more)

### Community 6 - "payments.py"
Cohesion: 0.15
Nodes (16): Payment, _draw_receipt_card(), _generate_receipt(), initiate_payment(), post, Session, Draws a card-style E-Challan receipt: dark header with icon, labeled rows, a…, verify_payment() (+8 more)

### Community 7 - "User"
Cohesion: 0.18
Nodes (16): User, create_manual_challan(), dispute_challan(), get_challan_detail(), my_challans(), get, post, Session (+8 more)

### Community 8 - "schema.sql"
Cohesion: 0.31
Nodes (12): challans, evidence, idx_challans_vehicle, idx_otp_mobile, idx_vehicles_plate, notifications, officers, otp_codes (+4 more)

### Community 9 - "overview"
Cohesion: 0.31
Nodes (9): overview(), get, Session, Violation-type counts, and a simple weekly time series for the admin charts., Grid-based density approximation for a hotspot heatmap. Buckets challans by…, repeat_offenders(), violation_hotspots(), violation_trends() (+1 more)

### Community 10 - "backend/app/config.py"
Cohesion: 0.29
Nodes (6): Config, Settings, BaseSettings, Config, Settings, pydantic_settings

## Knowledge Gaps
- **2 isolated node(s):** `Config`, `Config`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 143 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OpenLPRClient` connect `test_open_lpr.py` to `detect.py`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `detect_violation()` connect `schemas.py` to `models.py`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `OpenLPRClient` (e.g. with `get_open_lpr_client()` and `OpenLPRResult`) actually correct?**
  _`OpenLPRClient` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Config`, `Config` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `models.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05636114911080711 - nodes in this community are weakly interconnected._
- **Should `detect.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06583850931677018 - nodes in this community are weakly interconnected._
- **Should `os` be split into smaller, more focused modules?**
  _Cohesion score 0.08490566037735849 - nodes in this community are weakly interconnected._