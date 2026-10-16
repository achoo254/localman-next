import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { elementPath } from "../access/element-access-view.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { displayNames } from "../users/display-names.js";
import { mentionedReaders, readersAmong } from "./comment-mentions.js";

/** Notices one author sends one person about comments, per window. */
const NOTICES_PER_RECIPIENT = { max: 10, windowMs: 10 * 60_000 };

/** Where a comment was written and by whom. */
export interface CommentPlace {
	readonly element: ElementRecord;
	readonly authorId: string;
	/** `null` on the collection itself. */
	readonly nodeId: string | null;
	readonly nodeName: string | null;
	readonly commentId: string;
	/** Set for a comment of a pull request: the link opens it there. */
	readonly pullRequestId?: string | null;
}

/** Who a comment tells, worked out before it is written. */
export interface CommentNotices {
	/** Everyone it @mentions who can open the collection (stored on it). */
	readonly mentioned: readonly string[];
	readonly mentions: readonly string[];
	readonly replies: readonly string[];
	readonly authorName: string | null;
}

/** Opens the item with the comments panel on this comment. */
export function commentLink(place: CommentPlace): string {
	const query = new URLSearchParams();
	if (place.pullRequestId) query.set("pr", place.pullRequestId);
	else if (place.nodeId !== null) query.set("node", place.nodeId);
	query.set("comment", place.commentId);
	return `${elementPath(place.element)}?${query.toString()}`;
}

/**
 * The people to tell about a comment: those it @mentions (and were not
 * told before, `already`), and for a reply everyone who wrote in the
 * thread except those it mentions. Reads only, so a failure here leaves
 * nothing written.
 */
export async function planNotices(
	element: ElementRecord,
	authorId: string,
	body: string,
	already: readonly string[],
	threadAuthors: readonly string[] = [],
): Promise<CommentNotices> {
	const mentioned = await mentionedReaders(body, element, authorId);
	const readers = await readersAmong(threadAuthors, element, authorId);
	const authorName = (await displayNames([authorId])).get(authorId) ?? null;
	return {
		mentioned,
		mentions: mentioned.filter((sub) => !already.includes(sub)),
		replies: readers.filter((sub) => !mentioned.includes(sub)),
		authorName,
	};
}

/**
 * Sends the planned notices in the background; past
 * `NOTICES_PER_RECIPIENT` from this author a person is not told again.
 */
export async function sendNotices(
	place: CommentPlace,
	notices: CommentNotices,
): Promise<void> {
	const service = getNotificationService();
	const params = {
		author: notices.authorName,
		collection: place.element.name,
		item: place.nodeName,
	};
	const link = commentLink(place);
	const batches = [
		["comment.mentioned", notices.mentions],
		["comment.replied", notices.replies],
	] as const;
	for (const [type, recipients] of batches) {
		for (const sub of recipients) {
			const allowed = await takeRateLimitSlot(
				"comment-notice",
				`${place.authorId}:${sub}`,
				NOTICES_PER_RECIPIENT,
			).catch(() => false);
			if (allowed) service.notifyLater(sub, { type, params, link });
		}
	}
}
