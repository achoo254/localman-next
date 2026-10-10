---
title: Phase 11 workspaces and a deploy shared with another session
date: 2026-10-10
summary: "Phase 11 committed (ab72a5b); layout deployed (ff2bb02) but the release also carried another session's trial WIP"
---

# Phase 11 workspaces and a deploy shared with another session

## What happened
- Layout of `/api-client` brought to the prototype (stacked request/response, phone drawer, full-width header) and committed as `ff2bb02`; deployed to prod as release `20261010-072644-ff2bb02b0a53-dirty`.
- Phase 11 (workspaces, Postman-style roles, element sharing, access requests, move) built by parallel agents on a contract written first (shared permission tables, models, adapter registry, notification types, registry placeholders), reviewed twice and committed as `ab72a5b` (Closes #50), behind the `workspaces` flag.
- Reviews found real bugs: approve could grant Editor after an in-place upgrade (fixed with `role` on approve and `notifiedRole` on notifications), a share-only Editor could move a team element away, email shares bound to unverified accounts, the hand-over of ownership I added bypassed the team-workspace limit (kept by Jev's decision), an in-app invite accept lost the joined workspace.

## What went wrong
- `infra/localman/deploy.sh` builds the working tree. A second Claude session (Pro trial) was editing the same tree, so its WIP (`user-model.ts` trial fields, trial constants) shipped with the layout release; Mongoose auto-created the partial index `planExpiresAt_1` on prod `users` (0 matching docs). Left in place, the trial session was told.
- `git stash pop` of phase 11 stopped on files the trial session had edited; restored by checking out non-overlapping files from the stash (which also stages them — unstaged afterwards) and 3-way merging 5 shared files with `git merge-file`, keeping both sides.

## Decision
- Commit only one's own hunks when sessions share a tree: set the index of shared files from a known pure version (`git restore --staged --source=<rev>`), never `git add` a shared file, then prove the commit alone with `git checkout-index -a --prefix=<dir>` + `pnpm install --offline` + full gates.
- Before deploying, check `git status` right before `deploy.sh`; a `-dirty` release id means the tree is not the commit.

## Next steps
- Phase 12 mounts `ShareDialog`, registers the collection adapter and cascades workspace deletion to elements, shares and requests.
- Nothing of phase 11 is in prod; `ab72a5b` and `ff2bb02` are not pushed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
