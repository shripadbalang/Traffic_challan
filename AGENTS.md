# Agent Coding Guidelines & Knowledge Graph Navigation

## Knowledge Graph (graphify)

This project has an indexed knowledge graph at `graphify-out/`.

### Rules for AI Agents:
- **Architecture & Codebase Questions**: When `graphify-out/graph.json` exists, always prioritize querying the knowledge graph before grepping or reading arbitrary source files:
  - `graphify query "<question>"`: Returns a relevant scoped subgraph answering conceptual or dataflow questions.
  - `graphify path "<ConceptA>" "<ConceptB>"`: Returns the shortest dependency / call path between two concepts.
  - `graphify explain "<Concept>"`: Returns inbound/outbound relationships for a class, function, route, or model.
- **Incremental Updates**: After modifying, adding, or deleting code files in this repository, run `graphify . --update` to refresh the AST knowledge graph incrementally without LLM costs.
- **Broad System Review**: Read `graphify-out/GRAPH_REPORT.md` only for broad high-level architecture overviews, God Nodes, and community clusters.
