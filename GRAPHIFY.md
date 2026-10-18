# Traffic E-Challan — Knowledge Graph (Graphify) Guide

This project integrates **Graphify** ([Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)) to transform the codebase, its database schemas, ML pipelines, and microservices into a queryable knowledge graph.

Instead of searching through disparate files with grep, both developers and AI assistants can navigate exact relationships, trace call paths, and explore architectural communities.

---

## 1. Quick Start

### Prerequisites
Install the `graphifyy` CLI tool (isolated via `uv` or `pip`):
```bash
uv tool install "graphifyy[sql]"
# or: pip install "graphifyy[sql]"
```

### Inspect Knowledge Graph Status
```bash
python scripts/run_graphify.py status
```

### Build or Refresh the Knowledge Graph
```bash
python scripts/run_graphify.py build
```
This parses AST across `backend/`, `ml-service/`, and `backend/db/schema.sql`, generating all outputs in `graphify-out/`.

### Incremental Updates (on code changes)
```bash
python scripts/run_graphify.py update
```
Re-extracts only changed files without rebuilding the entire graph.

---

## 2. Interactive Visualizations

Graphify generates 3 rich, interactive browser-based visual views:

| View | File | Description | Open Command |
|---|---|---|---|
| **Community Knowledge Graph** | `graphify-out/graph.html` | Force-directed Cytoscape network with community coloring, search, and node inspectors | `python scripts/run_graphify.py serve` |
| **Interactive Call-Flow** | `graphify-out/callflow.html` | Mermaid architecture diagrams mapping call chains and service dependencies | `python scripts/run_graphify.py serve --callflow` |
| **D3 Hierarchy Tree** | `graphify-out/GRAPH_TREE.html` | D3 collapsible tree view of files, classes, and symbols | `python scripts/run_graphify.py serve --tree` |
| **Architecture Report** | `graphify-out/GRAPH_REPORT.md` | Plain-language intelligence summary of god nodes, clusters, and suggested questions | View in editor |

---

## 3. Querying the Knowledge Graph

### A. Natural Language / Structural Query
Ask questions about system flow, architecture, or cross-service interactions:
```bash
python scripts/run_graphify.py query "How does violation detection trigger challan creation?"
python scripts/run_graphify.py query "Where are payments verified and receipts rendered?"
```

### B. Shortest Path Tracing
Find the exact chain of calls and imports between any two components:
```bash
# Path between violation detection and challan creation (1 hop):
python scripts/run_graphify.py path "detect_violation()" "create_challan()"

# Path between detection runner and router:
python scripts/run_graphify.py path "run_detection()" "detect_violation()"

# Path between payment initiation and User model:
python scripts/run_graphify.py path "initiate_payment()" "User"
```

### C. Node Inspection & Explanation
View all inbound/outbound calls, imports, and references for a specific component:
```bash
python scripts/run_graphify.py explain "create_challan()"
python scripts/run_graphify.py explain "User"
python scripts/run_graphify.py explain "process_image()"
```

---

## 4. Key Architectural Insights (God Nodes & Hubs)

From the generated `graphify-out/GRAPH_REPORT.md`:

### Top God Nodes (Core Abstractions)
1. **`User`** (`backend/app/models.py`) — Central identity abstraction linked to auth, challans, disputes, and payments.
2. **`notify_challan_created()`** (`backend/app/services/notification_service.py`) — Notification bridge triggered after automated and manual violation issuance.
3. **`create_challan()`** (`backend/app/services/challan_engine.py`) — Core business logic calculating risk scores, assessing fines, and committing records to PostgreSQL.
4. **`detect_violation()`** (`backend/app/routers/violations.py`) — Public ingress endpoint orchestrating evidence upload, ML inference, vehicle plate matching, and challan generation.
5. **`process_image()`** & **`_ocr_plate()`** (`ml-service/app/detect.py`) — Core computer vision inference orchestrators for YOLO detections and EasyOCR recognition.

### Key Communities
- **`create_challan`**: Violation detection, vehicle registry fuzzy lookup, fine calculation, evidence committing.
- **`detect.py`**: YOLO model inference (helmet, wrong-side, triple riding, plate) and OCR text processing.
- **`schema.sql`**: Relational database DDL, indexes, and tables (`challans`, `vehicles`, `evidence`, `payments`).
- **`payments.py`**: Razorpay payment order initiation, signature verification, and ReportLab PDF receipt drawing.
- **`models.py` & `schemas.py`**: SQLAlchemy ORM definitions and Pydantic validation contracts.

---

## 5. Antigravity & AI Agent Integration

This project has native Antigravity skill and always-on rule configurations committed:

- **`.agents/rules/graphify.md`**: An `always_on` rule instructing Antigravity to check `graphify-out/graph.json` before grepping or guessing code paths.
- **`.agents/workflows/graphify.md`**: Native `/graphify` workflow support.
- **`.agents/skills/graphify/SKILL.md`**: Full progressive-disclosure skill with references.
- **`AGENTS.md`**: Cross-agent guidance for Cursor, Codex, Claude Code, and Kiro.

### Optional: Antigravity MCP Server
To allow the Antigravity agent to query the graph live using structured MCP tools (`query_graph`, `shortest_path`, `get_node`), add this block to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "graphify": {
      "command": "uv",
      "args": [
        "run",
        "--with", "graphifyy",
        "--with", "mcp",
        "-m", "graphify.serve",
        "${workspace.path}/graphify-out/graph.json"
      ]
    }
  }
}
```

---

## 6. Noise Filtering (`.graphifyignore`)

The `.graphifyignore` file at repository root prevents polluting the knowledge graph:
- Ignores virtual environments (`backend/venv/`, `ml-service/venv/`).
- Ignores model weight binaries (`*.pt`, `*.onnx`).
- Ignores test media and evidence storage (`test-assets/**`, `storage/**`).
- Ignores build and run caches (`__pycache__`, `runs/**`, `graphify-out/cache/`).
