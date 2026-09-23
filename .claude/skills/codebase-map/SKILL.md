---
name: codebase-map
description: Build a reviewable, file-grounded map of Skill Studio's capabilities, system shape, data lifecycle, boundaries, and extension points.
disable-model-invocation: true
---

# Codebase map

Build a reviewable Skill Studio codebase and context map without changing production behavior.

Ground it in `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/privacy.md`, `docs/conventions.md`, and the source code.

Include:

1. Product capabilities: Library, Editor, and Test Lab.
2. A user-flow map from discovery through edit, saved version, and side-by-side test run.
3. A codebase map with key directories, owning files, and important call paths.
4. A system map: browser, HTTP/SSE server, domain logic, catalog/filesystem, SQLite, and Claude CLI.
5. A data and lifecycle map separating installed skills, immutable versions, test cases, live traces, and saved run records.
6. Trust, privacy, accessibility, and failure boundaries.
7. Existing extension points and reusable seams for small features.
8. Open questions, awkward behavior, and opportunities for small improvements.

Use file references for material claims. Choose the format that communicates the system best: a diagram or canvas, HTML, a document, or a combination. Do not propose or implement features yet.
