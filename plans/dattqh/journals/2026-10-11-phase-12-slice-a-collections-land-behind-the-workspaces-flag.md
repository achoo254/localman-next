---
title: "Phase 12 slice A: collections land behind the workspaces flag"
date: 2026-10-11
summary: "Collections (tree, codec v2.1, inheritance, trash) committed as 8f099c0 after two review rounds"
---

# Phase 12 slice A: collections land behind the workspaces flag

## What happened
- Jev split phase 12 into slice A (enough to turn the workspaces flag on) and slice B (changelog, tags/status, examples, trash filters, multi-select).
- Contract first (shared collection types/schemas, three Mongo models, registry placeholder), then parallel agents: API, shared codec/inheritance, web (three rounds).
- Committed as `8f099c0`: 228 files; lint, typecheck, 539 files / 3979 tests, MCP coverage, tokens and E2E 32/32 green, incl. a Postman collection nested 3 levels sent with inherited auth and exported back.

## What reviews caught
- Backend: a removed deleter could restore a team collection into their own workspace (fixed: trash rights follow the current role, user decided after Jev split 0.59/0.41); collections had no byte budget (~2 GiB possible, fixed: 20 MiB); stale-view drops produced duplicate order keys; moves bypassed the 1000 cap.
- My own contract had a partial index on `$exists: false`, which MongoDB cannot build; the API agent replaced it.
- Web: Viewer Ctrl+S 403, saves reverting sidebar renames, bound tabs silently sent loose when the collection was unreadable, autosave races, per-node duplicate and fan-out search (moved server-side).

## Decisions
- Codec in packages/shared; official v2.1.0 schema vendored (Apache-2.0) and checked with ajv-draft-04 in tests.
- Secret variable values: returned to anyone who can view (display flag), blanked only in exported files.
- Workspace deletion trashes its collections; history keeps `auth: inherit` (inherited credentials never stored).

## Next steps
- Slice B of phase 12; then the flag decision and deploy (only on explicit user request).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
