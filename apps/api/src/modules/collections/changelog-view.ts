import {
	CHANGELOG_ACTIONS,
	CHANGELOG_SESSION_WINDOW_MS,
	type ChangelogChange,
	type ChangelogSession,
} from "@localman/shared/api-client";
import { z } from "zod";
import type { StoredRevision } from "./collection-revision-model.js";

export const changeView = z.object({
	id: z.string(),
	at: z.string(),
	action: z.enum(CHANGELOG_ACTIONS),
	entity: z.enum(["collection", "node"]),
	entityId: z.string(),
	entityKind: z.enum(["collection", "folder", "request", "example"]),
	entityName: z.string(),
	fields: z.array(z.string()),
	summary: z.string(),
	hidden: z.boolean(),
	restorable: z.boolean(),
});

export const changelogPageView = z.object({
	sessions: z.array(
		z.object({
			authorId: z.string(),
			authorName: z.string().nullable(),
			from: z.string(),
			to: z.string(),
			changes: z.array(changeView),
		}),
	),
	nextBefore: z.string().nullable(),
});

export const activityView = z.object({
	items: z.array(
		changeView.extend({
			authorId: z.string(),
			authorName: z.string().nullable(),
		}),
	),
});

export const diffView = z.object({
	revisionId: z.string(),
	hidden: z.boolean(),
	available: z.boolean(),
	before: z.unknown(),
	after: z.unknown(),
	affected: z
		.array(
			z.object({
				nodeId: z.string(),
				name: z.string().nullable(),
				change: z.enum(["added", "removed", "changed"]),
			}),
		)
		.optional(),
});

/** Revision metadata as the changelog shows it (never its patches). */
export type RevisionMeta = Omit<StoredRevision, "forward" | "inverse">;

/**
 * A change; `newestPartial` is the newest revision without patches, which
 * nothing older can be restored across.
 */
export function toChange(
	rev: RevisionMeta,
	newestPartial: number,
): ChangelogChange {
	return {
		id: rev._id.toHexString(),
		at: rev.at.toISOString(),
		action: rev.action,
		entity: rev.entity,
		entityId: rev.entityId,
		entityKind: rev.entityKind,
		entityName: rev.entityName,
		fields: [...rev.fields],
		summary: rev.fields.join(", "),
		hidden: rev.hidden,
		restorable: rev.seq >= newestPartial,
	};
}

/**
 * Sessions of revisions listed newest first: one author's consecutive
 * changes within `CHANGELOG_SESSION_WINDOW_MS` of the session's first
 * (oldest) change, as stored on each revision (`sessionStartSeq`).
 * Revisions written before that are grouped here, oldest first, so their
 * bounds only depend on older revisions: the oldest one given must start
 * a session (see `changelog-page.ts`).
 */
export function toSessions(
	revisions: readonly RevisionMeta[],
	newestPartial: number,
	names: ReadonlyMap<string, string>,
): ChangelogSession[] {
	const sessions: ChangelogSession[] = [];
	let first: RevisionMeta | null = null;
	let last: RevisionMeta | null = null;
	for (const rev of [...revisions].reverse()) {
		const current = sessions.at(-1);
		const change = toChange(rev, newestPartial);
		if (current && first && last && joinsSession(first, last, rev)) {
			current.changes.unshift(change);
			current.to = change.at;
		} else {
			sessions.push({
				authorId: rev.authorId,
				authorName: names.get(rev.authorId) ?? null,
				from: change.at,
				to: change.at,
				changes: [change],
			});
			first = rev;
		}
		last = rev;
	}
	return sessions.reverse();
}

/**
 * Whether `rev` (the next newer revision after `last`) belongs to the
 * session that `first` opened: the session stored on both, or for older
 * revisions without one, the same author within the window.
 */
export function joinsSession(
	first: RevisionMeta,
	last: RevisionMeta,
	rev: RevisionMeta,
): boolean {
	if (last.authorId !== rev.authorId) return false;
	const mark = rev.sessionStartSeq;
	if (typeof mark === "number") return first.sessionStartSeq === mark;
	if (typeof first.sessionStartSeq === "number") return false;
	return rev.at.getTime() - first.at.getTime() <= CHANGELOG_SESSION_WINDOW_MS;
}
