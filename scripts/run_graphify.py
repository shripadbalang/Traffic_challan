#!/usr/bin/env python3
"""
Traffic E-Challan - Graphify Automation CLI
Production runner for generating, querying, and serving the system knowledge graph.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
GRAPH_OUT_DIR = ROOT_DIR / "graphify-out"
GRAPH_JSON = GRAPH_OUT_DIR / "graph.json"
GRAPH_HTML = GRAPH_OUT_DIR / "graph.html"
GRAPH_REPORT = GRAPH_OUT_DIR / "GRAPH_REPORT.md"


def _resolve_graphify_cmd() -> list[str]:
    """Find the best command to invoke graphify."""
    exe = shutil.which("graphify")
    if exe:
        return [exe]
    
    # Try uvx if graphify is not directly on PATH
    uvx_exe = shutil.which("uvx")
    if uvx_exe:
        return [uvx_exe, "--from", "graphifyy", "graphify"]
    
    # Try python -m graphify
    return [sys.executable, "-m", "graphify"]


def _run_cmd(cmd: list[str], cwd: Path | None = None) -> int:
    """Execute a shell command with real-time streaming."""
    cwd = cwd or ROOT_DIR
    print(f"[graphify] Running: {' '.join(str(c) for c in cmd)}")
    try:
        proc = subprocess.run(cmd, cwd=cwd)
        return proc.returncode
    except FileNotFoundError:
        print(
            "\n[error] 'graphify' executable not found on PATH.\n"
            "Install it via uv (recommended) or pip:\n"
            "  uv tool install graphifyy\n"
            "  pip install graphifyy\n",
            file=sys.stderr,
        )
        return 1


def cmd_build(args: argparse.Namespace) -> int:
    """Build or rebuild the knowledge graph from scratch."""
    cmd = _resolve_graphify_cmd()
    
    # Using extract --code-only for deterministic local AST extraction
    subcmd = ["extract", str(ROOT_DIR), "--code-only"]
    if args.force:
        subcmd.append("--force")
    if args.mode == "deep":
        subcmd.extend(["--mode", "deep"])

    ret = _run_cmd(cmd + subcmd)
    if ret != 0:
        return ret

    print("[graphify] Clustering communities and generating report...")
    _run_cmd(cmd + ["cluster-only", str(ROOT_DIR)])

    # Also build the callflow HTML diagram and tree visualization if requested or default
    if not args.skip_exports:
        print("[graphify] Generating Mermaid call-flow diagram...")
        _run_cmd(cmd + ["export", "callflow-html", str(ROOT_DIR), "--output", str(GRAPH_OUT_DIR / "callflow.html")])
        print("[graphify] Generating D3 collapsible tree visualization...")
        _run_cmd(cmd + ["tree", "--graph", str(GRAPH_JSON), "--output", str(GRAPH_OUT_DIR / "GRAPH_TREE.html")])

    print("\n[graphify] Build complete!")
    print(f"  Graph Data:   {GRAPH_JSON}")
    print(f"  Interactive:  {GRAPH_HTML}")
    print(f"  Report:       {GRAPH_REPORT}")
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    """Incrementally update the graph for changed files only."""
    cmd = _resolve_graphify_cmd()
    subcmd = [str(ROOT_DIR), "--update"]
    if not getattr(args, "with_docs", False):
        subcmd.append("--code-only")
    ret = _run_cmd(cmd + subcmd)
    if ret != 0:
        return ret
    print("[graphify] Refreshing clusters and report...")
    _run_cmd(cmd + ["cluster-only", str(ROOT_DIR)])
    print("[graphify] Incremental update complete.")
    return 0


def cmd_query(args: argparse.Namespace) -> int:
    """Query the knowledge graph with a natural language or conceptual question."""
    if not GRAPH_JSON.exists():
        print("[graphify] Knowledge graph not found. Building it first...")
        build_ret = cmd_build(argparse.Namespace(force=False, mode="standard", skip_exports=True))
        if build_ret != 0:
            return build_ret

    cmd = _resolve_graphify_cmd() + ["query", args.question]
    if args.dfs:
        cmd.append("--dfs")
    if args.budget:
        cmd.extend(["--budget", str(args.budget)])
    return _run_cmd(cmd)


def cmd_path(args: argparse.Namespace) -> int:
    """Find the shortest relationship path between two nodes in the graph."""
    if not GRAPH_JSON.exists():
        print("[error] Knowledge graph does not exist. Run 'build' first.", file=sys.stderr)
        return 1
    cmd = _resolve_graphify_cmd() + ["path", args.node_a, args.node_b]
    return _run_cmd(cmd)


def cmd_explain(args: argparse.Namespace) -> int:
    """Inspect and explain a node and all its inbound/outbound connections."""
    if not GRAPH_JSON.exists():
        print("[error] Knowledge graph does not exist. Run 'build' first.", file=sys.stderr)
        return 1
    cmd = _resolve_graphify_cmd() + ["explain", args.node]
    return _run_cmd(cmd)


def cmd_serve(args: argparse.Namespace) -> int:
    """Launch the interactive browser UI for the knowledge graph."""
    target_html = GRAPH_HTML
    if args.callflow:
        target_html = GRAPH_OUT_DIR / "callflow.html"
    elif args.tree:
        target_html = GRAPH_OUT_DIR / "GRAPH_TREE.html"

    if not target_html.exists():
        print(f"[warning] {target_html.name} not found. Running build first...")
        cmd_build(argparse.Namespace(force=False, mode="standard", skip_exports=False))

    if not target_html.exists():
        print(f"[error] Could not locate or generate {target_html}", file=sys.stderr)
        return 1

    print(f"[graphify] Opening interactive viewer: {target_html.resolve()}")
    webbrowser.open(target_html.resolve().as_uri())
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    """Display the health, size, and statistics of the current knowledge graph."""
    print("=== Traffic E-Challan Knowledge Graph Status ===")
    if not GRAPH_JSON.exists():
        print("Status: NOT BUILT")
        print("Run 'python scripts/run_graphify.py build' to generate the graph.")
        return 0

    try:
        data = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
        nodes = data.get("nodes", [])
        edges = data.get("links", data.get("edges", []))
        stats = os.stat(GRAPH_JSON)
        print("Status:           READY")
        print(f"Location:         {GRAPH_JSON}")
        print(f"Total Nodes:      {len(nodes):,}")
        print(f"Total Edges:      {len(edges):,}")
        print(f"File Size:        {stats.st_size / 1024:.1f} KB")
        print(f"HTML Viewer:      {'Available' if GRAPH_HTML.exists() else 'Missing'}")
        print(f"Report:           {'Available' if GRAPH_REPORT.exists() else 'Missing'}")
        print(f"Callflow Diagram: {'Available' if (GRAPH_OUT_DIR / 'callflow.html').exists() else 'Missing'}")
    except Exception as exc:
        print(f"Status: ERROR reading graph.json ({exc})")
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Traffic E-Challan Knowledge Graph (Graphify) Manager",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # Build
    p_build = subparsers.add_parser("build", help="Build or rebuild the knowledge graph")
    p_build.add_argument("--force", action="store_true", help="Force full rescan ignoring caches")
    p_build.add_argument("--mode", choices=["standard", "deep"], default="standard", help="Extraction depth")
    p_build.add_argument("--skip-exports", action="store_true", help="Skip callflow and tree diagram generation")
    p_build.set_defaults(func=cmd_build)

    # Update
    p_update = subparsers.add_parser("update", help="Incrementally update graph for changed files")
    p_update.add_argument("--with-docs", action="store_true", help="Include semantic doc extraction (requires LLM API key)")
    p_update.set_defaults(func=cmd_update)

    # Query
    p_query = subparsers.add_parser("query", help="Ask a question against the knowledge graph")
    p_query.add_argument("question", help="Natural language question about the architecture")
    p_query.add_argument("--dfs", action="store_true", help="Use DFS rather than BFS traversal")
    p_query.add_argument("--budget", type=int, default=1500, help="Token budget for context")
    p_query.set_defaults(func=cmd_query)

    # Path
    p_path = subparsers.add_parser("path", help="Find shortest path between two concepts")
    p_path.add_argument("node_a", help="Source concept or file")
    p_path.add_argument("node_b", help="Target concept or file")
    p_path.set_defaults(func=cmd_path)

    # Explain
    p_explain = subparsers.add_parser("explain", help="Explain a specific concept and its connections")
    p_explain.add_argument("node", help="Concept, function, route, or file name to inspect")
    p_explain.set_defaults(func=cmd_explain)

    # Serve
    p_serve = subparsers.add_parser("serve", help="Open the interactive graph viewer in browser")
    p_serve.add_argument("--callflow", action="store_true", help="Open Mermaid callflow diagram")
    p_serve.add_argument("--tree", action="store_true", help="Open D3 tree viewer")
    p_serve.set_defaults(func=cmd_serve)

    # Status
    p_status = subparsers.add_parser("status", help="Print status and metrics of knowledge graph")
    p_status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
