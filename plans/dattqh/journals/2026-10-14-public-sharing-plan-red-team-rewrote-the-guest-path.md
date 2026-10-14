---
title: "Public sharing plan: red team rewrote the guest path"
date: 2026-10-14
summary: "Wave 1 (public sharing 15a) planned; four hostile reviewers found 40 issues, 15 kept, five critical, three owner decisions"
---

# Public sharing plan: red team rewrote the guest path

## What happened
- After the post-multi-tenant review, the owner kept the wave order (public sharing, then runner/CLI, then the rest of
  multi-tenant). Phase 15 of the core plan depends on phase 14 (fork, XL), so it was split: 15a now (public link,
  guest, access key, Run button in import mode, secret warning), fork later.
- Plan `plans/dattqh/261014-0825-public-sharing-links-keys-run/`, 6 phases (L). Draft from two scouts; then four
  red-team reviewers (security, failure modes, assumptions, scope): 40 findings, 15 after dedupe, all accepted.
- Earlier the same day: the Cloudflare Web Analytics beacon was allowed in the primary site's CSP and deployed
  (`4565fb2`, tenant hosts are not proxied and kept the stricter policy); the flaky `workbench-renders` test got a
  skeleton wait and a self-diagnosing assertion after five hypotheses failed to reproduce it (`5aeede8`, cause still
  unproven).

## What the red team caught
- Guest as a normal Viewer leaks everything: the internal collection view returns secret variables and credentials as
  stored (`collection-view.ts:139-143`), plus changelog and duplicate. The draft's "every outward path is redacted"
  invariant was false from phase 03.
- Saved examples carry real tokens (response body, `Set-Cookie`, the original request); the draft only redacted the
  request draft. `isSensitiveName` did not match `set-cookie`.
- The shared `buildUrlWithParams` rebuilds the query with `URLSearchParams` and encodes `{{var}}`; moving
  `redactDraft` onto it would have broken history too.
- I wrote a partial unique index "while not revoked" (`$exists: false`) again; MongoDB cannot build it. The same
  mistake was caught in phase 12. Revocation is now a delete.
- `VITE_FEATURES` gates only the web build; on the shared working tree any session's deploy would have exposed the new
  public endpoints and MCP tools before SAST/DAST. Added a server gate `PUBLIC_SHARING_ENABLED`.
- Smaller: capability ids in URL paths land in the nginx access log; per-key rate limits do not stop key guessing and
  create one Mongo document per guess; MCP confirmation was on the safe direction (disable) instead of the risky one
  (enable, import).

## Decisions (owner, 2026-10-14)
- Guest sees the redacted view and can request edit access; opening a guest link grants nothing.
- Example response bodies are dropped from every public output.
- Only workspace members with Admin/Editor publish; three admin switches, default on, cut existing links/keys at once.
- Release once at phase 06; public Run-button imports skip scripts unless the user opts in.

## Lessons
- Check the existing read path before reusing a role for an outside audience: "Viewer" here means "sees secrets".
- Search past journals for known MongoDB index limits before writing a model contract.

## Next steps
- `/ak:cook plans/dattqh/261014-0825-public-sharing-links-keys-run/plan.md`, phase 01 first.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
