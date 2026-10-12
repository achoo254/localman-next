import {
	CHANGELOG_REVISIONS_MAX,
	CHANGELOG_SESSION_WINDOW_MS,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { type RevisionMeta, joinsSession } from "./changelog-view.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";

/** Revisions one changelog page holds, before it is cut on a session. */
export const CHANGELOG_PAGE = 100;
const META = { forward: 0, inverse: 0 } as const;

/** Revisions of one changelog page, newest first. */
export interface RevisionPage {
	readonly rows: RevisionMeta[];
	/** `seq` of its oldest revision when older ones exist. */
	readonly nextBefore: string | null;
}

async function rowsBelow(
	collectionId: Types.ObjectId,
	below: number | null,
	limit: number,
): Promise<RevisionMeta[]> {
	return CollectionRevisionModel.find(
		{
			collectionId,
			trimmed: { $ne: true },
			...(below === null ? {} : { seq: { $lt: below } }),
		},
		META,
	)
		.sort({ seq: -1 })
		.limit(limit)
		.lean<RevisionMeta[]>();
}

/** Older revisions that may still share a session with `from`. */
interface Chain {
	readonly rows: RevisionMeta[];
	/** A revision older than the chain exists. */
	readonly more: boolean;
}

/**
 * The revisions just older than `from` by the same author, each at most
 * `CHANGELOG_SESSION_WINDOW_MS` before the next: a session never spans a
 * change by someone else or a longer gap, so the chain's oldest revision
 * starts a session. Bounded by what the changelog keeps.
 */
async function chainBelow(
	collectionId: Types.ObjectId,
	from: RevisionMeta,
): Promise<Chain> {
	const rows: RevisionMeta[] = [];
	let newer = from;
	while (rows.length < CHANGELOG_REVISIONS_MAX) {
		const batch = await rowsBelow(collectionId, newer.seq, CHANGELOG_PAGE);
		for (const rev of batch) {
			const gap = newer.at.getTime() - rev.at.getTime();
			if (rev.authorId !== from.authorId || gap > CHANGELOG_SESSION_WINDOW_MS) {
				return { rows, more: true };
			}
			rows.push(rev);
			newer = rev;
		}
		if (batch.length < CHANGELOG_PAGE) return { rows, more: false };
	}
	return { rows, more: true };
}

/**
 * Index in `rows` (newest first, the last one starting a session) of the
 * oldest revision of the session holding `rows[target]`.
 */
function sessionStart(rows: readonly RevisionMeta[], target: number): number {
	let start = rows.length - 1;
	for (let index = rows.length - 2; index >= target; index -= 1) {
		const first = rows[start];
		const last = rows[index + 1];
		const rev = rows[index];
		if (!first || !last || !rev) break;
		if (!joinsSession(first, last, rev)) start = index;
	}
	return start;
}

/**
 * A page whose oldest revision stores its session's first one (`start`):
 * the rest of that session is the revisions from `start` up to it (one
 * range query on `{ collectionId, seq }`), then one check for older ones.
 */
async function storedSessionPage(
	collectionId: Types.ObjectId,
	page: RevisionMeta[],
	oldest: RevisionMeta,
	start: number,
): Promise<RevisionPage> {
	const rest =
		start < oldest.seq
			? await CollectionRevisionModel.find(
					{
						collectionId,
						trimmed: { $ne: true },
						seq: { $gte: start, $lt: oldest.seq },
					},
					META,
				)
					.sort({ seq: -1 })
					.lean<RevisionMeta[]>()
			: [];
	const kept = [...page, ...rest];
	const last = kept.at(-1) ?? oldest;
	const older = await CollectionRevisionModel.exists({
		collectionId,
		trimmed: { $ne: true },
		seq: { $lt: last.seq },
	});
	return { rows: kept, nextBefore: older ? String(last.seq) : null };
}

/**
 * One page of the changelog below `before`, newest first: up to
 * `CHANGELOG_PAGE` revisions, extended to the start of the session its
 * oldest revision belongs to, so no session is split across two pages.
 * Revisions store their session; older ones without it walk their chain.
 * The next page starts right below a session's first change, which keeps
 * the grouping of every page the same as over the whole changelog.
 */
export async function loadChangelogPage(
	collectionId: Types.ObjectId,
	before: number | null,
): Promise<RevisionPage> {
	const rows = await rowsBelow(collectionId, before, CHANGELOG_PAGE + 1);
	const page = rows.slice(0, CHANGELOG_PAGE);
	const oldest = page.at(-1);
	if (rows.length <= CHANGELOG_PAGE || !oldest) {
		return { rows: page, nextBefore: null };
	}
	const start = oldest.sessionStartSeq;
	if (typeof start === "number") {
		return storedSessionPage(collectionId, page, oldest, start);
	}
	const chain = await chainBelow(collectionId, oldest);
	const all = [...page, ...chain.rows];
	const first = sessionStart(all, page.length - 1);
	const kept = all.slice(0, first + 1);
	const last = kept.at(-1);
	const more = first + 1 < all.length || chain.more;
	return { rows: kept, nextBefore: more && last ? String(last.seq) : null };
}
