import {
	CHANGELOG_ACTIONS,
	CHANGELOG_SESSION_GAP_MS,
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
 * changes less than `CHANGELOG_SESSION_GAP_MS` apart.
 */
export function toSessions(
	revisions: readonly RevisionMeta[],
	newestPartial: number,
	names: ReadonlyMap<string, string>,
): ChangelogSession[] {
	const sessions: ChangelogSession[] = [];
	let last: RevisionMeta | null = null;
	for (const rev of revisions) {
		const current = sessions.at(-1);
		const joins =
			current !== undefined &&
			last !== null &&
			last.authorId === rev.authorId &&
			last.at.getTime() - rev.at.getTime() <= CHANGELOG_SESSION_GAP_MS;
		const change = toChange(rev, newestPartial);
		if (joins && current) {
			current.changes.push(change);
			current.from = change.at;
		} else {
			sessions.push({
				authorId: rev.authorId,
				authorName: names.get(rev.authorId) ?? null,
				from: change.at,
				to: change.at,
				changes: [change],
			});
		}
		last = rev;
	}
	return sessions;
}
