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

## Release and DAST (same day)
- Owner chose commit, deploy, DAST. Jev picked env-first: the gate went into `/opt/localman/.env` before `deploy.sh`,
  so the new web build and the endpoints went live in one reload (release `20261014-075711-14bdeca6e2d0`).
- DAST from the owner's signed-in Chrome with a throwaway collection full of fake secrets: no fake secret left through
  any of the four paths; switches, revoke and purge each stop serving; guessing hits nginx's zone first, then the API's
  60/min per IP exactly at request 61. Data cleaned; logs carry no ids or keys.
- A browser-tool script timed out at 45 s while it waited out a rate-limit window, yet kept running in the page and did
  the cleanup; the next run found the collections gone. Never sleep inside page scripts; wait outside, then act.
- Our own probing from the same IP made the browser's reads answer 429 mid-test; re-check the masked branch after the
  window instead of reading 429 as a pass.

## Next steps
- Push the commits; watch `RATE_LIMITED` counts on `/api/v1/public/` for shared NAT users.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
