---
title: "Public sharing 15a built behind a server gate; SAST found four leaks in the one serializer"
date: 2026-10-14
summary: "Public link, guest link, access keys and Run button done on the working tree with PUBLIC_SHARING_ENABLED off; SAST found credentials still leaving through form fields, {{var}} mixes, URL fragments and example bodies"
---

# Public sharing 15a built behind a server gate

## What happened
- Executed `plans/dattqh/261014-0825-public-sharing-links-keys-run/` phases 01–05 in one session: redaction moved
  to `packages/shared` (one serializer for every outward path), 19 operations in `modules/public-sharing/` behind
  `servedOperations(registry, PUBLIC_SHARING_ENABLED)`, nginx log masks, badge SVG, web UI (built by a subagent from a
  written API contract while the server side was reviewed), docs, ADR 0004, three e2e specs.
- Checks: lint, typecheck, MCP coverage, tokens clean; 681 test files / 4869 tests; e2e 43/43 and the new specs 9/9
  with `--repeat-each=3`. Not committed, not deployed.

## What SAST caught
- The serializer was right by design and wrong in four places: credential-named urlencoded/form-data fields were
  neither hidden nor warned (the heuristic skipped them assuming redaction had), `isLiteralValue` treated
  `sk_live_x{{suffix}}` as a reference, URL fragments (`#access_token=`) passed, and example request bodies were never
  scanned. Fixed with regression tests; form fields are now redacted (owner's ADR updated with the reason).
- Two Admins PATCHing different switches overwrote each other because the whole `sharing` object was `$set`.
- nginx error lines quote the full URL, so `?access_key=` would reach the error log on an upstream failure.

## Lessons
- "Warn about what is not redacted" only holds if the scanner and the redactor agree on what was redacted; a skip in
  one based on an assumption about the other is where leaks hide. Test the pair, not each alone.
- Splitting server work (me) from UI work (subagent) worked because the API contract was written down first.

## Next steps
- User decision: commit, then deploy with `publicSharing` + `PUBLIC_SHARING_ENABLED=true`, then DAST on production.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
