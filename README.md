# 🚦 AI-Powered Traffic E-Challan System

An end-to-end automated traffic violation detection and electronic challan issuance platform. The system leverages custom-trained YOLO computer vision models to detect violations (e.g., riding without helmet, triple riding, wrong-side driving), identifies vehicle license plates via OCR, matches vehicles against registration records, and generates official electronic challans with integrated Razorpay payment and verifiable QR-coded PDF receipts.

---

## 📁 Repository Structure

This repository is organized as a **Full-Stack Monorepo**:

```
Traffic_challan/
├── backend/                            # FastAPI Core Backend Microservice (:8000)
│   ├── app/                            # API routers, business services, database models
│   ├── db/                             # PostgreSQL / Supabase schema & initial seeds
│   ├── scripts/                        # Administrative & database utility scripts
│   ├── storage/                        # Storage for violation evidence & PDF receipts
│   ├── tests/                          # Backend integration, auth & payment tests
│   ├── Dockerfile                      # Backend container configuration
│   └── requirements.txt
│
├── ml-service/                         # FastAPI + YOLO Computer Vision Microservice (:8001)
│   ├── app/                            # Detection pipeline, OCR engine & API endpoint
│   ├── models/                         # YOLO (.pt) weights for helmet, plate, triple, wrong-side
│   ├── tests/                          # ML benchmarks, OCR analysis & detection debug scripts
│   ├── Dockerfile                      # ML service container definition
│   └── requirements.txt
│
├── frontend/                           # Reserved for Citizen & Officer Web Portal (:5173)
│   ├── README.md                       # Architecture & setup guide for React/Vite portal
│   └── .gitkeep
│
├── test-assets/                        # Centralized sample media for testing and demos
│   ├── samples/                        # Sample traffic photos, plate crops & multi-rider scenes
│   └── README.md
│
├── docs/                               # Developer Guides & System Architecture
│   ├── architecture.md                 # System topology, sequence diagrams & components
│   ├── api.md                          # API contract & OpenAPI documentation
│   └── notes/                          # Developer references & testing scripts
│
├── scripts/                            # Monorepo automation & knowledge graph runners
│   └── run_graphify.py                 # Graphify CLI (build, update, query, path, serve)
│
├── graphify-out/                       # Generated Knowledge Graph & Visualizations
│   ├── graph.html                      # Interactive Cytoscape force-directed graph UI
│   ├── callflow.html                   # Interactive Mermaid call-flow diagram
│   ├── GRAPH_TREE.html                 # D3 collapsible symbol hierarchy
│   ├── GRAPH_REPORT.md                 # Architecture report (God nodes, communities)
│   └── graph.json                      # Machine-queryable knowledge graph
│
├── docker-compose.yml                  # Root multi-container orchestration
├── GRAPHIFY.md                         # Complete Graphify guide & query examples
├── .graphifyignore                     # Noise filter rules for AST knowledge graph
├── .env.example                        # Global environment variable template
├── .gitignore                          # Monorepo git rules (ignores model weights, caches, env)
└── README.md                           # Main repository documentation
```

---

## ⚡ Quickstart

### Option 1: Running with Docker Compose (Recommended)

1. **Clone the repository and prepare environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase / PostgreSQL credentials & Razorpay keys
   ```

2. **Launch all microservices**:
   ```bash
   docker compose up --build
   ```

3. **Verify running services**:
   - Backend API: `http://localhost:8000/docs`
   - ML Inference Service: `http://localhost:8001/docs`

---

### Option 2: Running Locally for Development

#### 1. Setup Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your PostgreSQL/Supabase database URL & secrets

# Apply DB schema in Supabase SQL editor or run:
# psql $DATABASE_URL -f db/schema.sql

# Seed demo database (Admin, Officers, Citizens, Vehicles & Challans):
python -m scripts.seed_demo_data

# Start backend server on port 8000:
uvicorn app.main:app --reload --port 8000
```

#### 2. Setup ML Inference Service (in a second terminal)
```bash
cd ml-service
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt

# Start ML service on port 8001:
uvicorn app.main:app --reload --port 8001
```

---

## 🧪 Running Tests & Diagnostics

### Backend Tests
```bash
cd backend

# Test database connection to Supabase / PostgreSQL:
python tests/test_db_connection.py

# Test fuzzy vehicle license plate matching:
python tests/test_fuzzy_match_direct.py

# Test full citizen signup, OTP auth, officer login, and Razorpay payment flow:
python tests/test_payment_flow.py

# Preview PDF receipt generation with verification QR code:
python tests/preview_receipt.py

# Test end-to-end AI violation ingestion:
python tests/test_ai_detection.py
```

### ML Inference & Benchmark Tests
```bash
cd ml-service

# Run standalone detection on a sample image:
python tests/test_detect.py

# Run license plate detection & OCR debugging:
python tests/test_plate_stages_debug.py

# Test motorcycle triple-riding model:
python tests/test_triple_debug.py
```

---

## 🧠 System Knowledge Graph (Graphify)

This project integrates a queryable knowledge graph powered by [Graphify](https://github.com/Graphify-Labs/graphify):

- **View Community Graph**: `python scripts/run_graphify.py serve` (opens `graphify-out/graph.html`)
- **View Call-Flow Diagrams**: `python scripts/run_graphify.py serve --callflow` (opens `graphify-out/callflow.html`)
- **Query Architecture Flow**: `python scripts/run_graphify.py query "How does violation detection trigger challan creation?"`
- **Shortest Path Analysis**: `python scripts/run_graphify.py path "detect_violation()" "create_challan()"`
- **Inspect Specific Node**: `python scripts/run_graphify.py explain "create_challan()"`
- **Architecture Insights Report**: [`graphify-out/GRAPH_REPORT.md`](file:///d:/workspace/Traffic_challan/graphify-out/GRAPH_REPORT.md)

---

## 📖 Detailed Documentation

- **[Knowledge Graph (Graphify) Guide](file:///d:/workspace/Traffic_challan/GRAPHIFY.md)**
- **[System Architecture & Data Flows](file:///d:/workspace/Traffic_challan/docs/architecture.md)**
- **[API Contracts & Schema Guide](file:///d:/workspace/Traffic_challan/docs/api.md)**
- **[Test Assets Reference](file:///d:/workspace/Traffic_challan/test-assets/README.md)**
- **[Frontend Portal Roadmap](file:///d:/workspace/Traffic_challan/frontend/README.md)**
- **[Backend Service Details](file:///d:/workspace/Traffic_challan/backend/README.md)**
- **[ML Microservice Details](file:///d:/workspace/Traffic_challan/ml-service/README.md)**
