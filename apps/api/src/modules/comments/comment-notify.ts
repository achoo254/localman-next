import { elementPath } from "../access/element-access-view.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { displayNames } from "../users/display-names.js";
import { mentionedReaders, readersAmong } from "./comment-mentions.js";

/** Where a comment was written and by whom. */
export interface CommentPlace {
	readonly element: ElementRecord;
	readonly authorId: string;
	/** `null` on the collection itself. */
	readonly nodeId: string | null;
	readonly nodeName: string | null;
	readonly commentId: string;
}

/** Opens the item with the comments panel on this comment. */
export function commentLink(place: CommentPlace): string {
	const query = new URLSearchParams();
	if (place.nodeId !== null) query.set("node", place.nodeId);
	query.set("comment", place.commentId);
	return `${elementPath(place.element)}?${query.toString()}`;
}

/**
 * Tells the people @mentioned in `body` who can open the collection and
 * were not told before (`already`); returns them, so the caller stores
 * them and a reply does not tell them twice.
 */
export async function notifyMentions(
	place: CommentPlace,
	body: string,
	already: readonly string[],
): Promise<string[]> {
	const mentioned = await mentionedReaders(body, place.element, place.authorId);
	const fresh = mentioned.filter((sub) => !already.includes(sub));
	await send(place, fresh, "comment.mentioned");
	return mentioned;
}

/**
 * Tells everyone who wrote in the thread before (and still can open the
 * collection) about a reply, except those the reply @mentions.
 */
export async function notifyReply(
	place: CommentPlace,
	threadAuthors: readonly string[],
	mentioned: readonly string[],
): Promise<void> {
	const readers = await readersAmong(
		threadAuthors,
		place.element,
		place.authorId,
	);
	await send(
		place,
		readers.filter((sub) => !mentioned.includes(sub)),
		"comment.replied",
	);
}

async function send(
	place: CommentPlace,
	recipients: readonly string[],
	type: "comment.mentioned" | "comment.replied",
): Promise<void> {
	if (recipients.length === 0) return;
	const author = (await displayNames([place.authorId])).get(place.authorId);
	const service = getNotificationService();
	for (const sub of recipients) {
		service.notifyLater(sub, {
			type,
			params: {
				author: author ?? null,
				collection: place.element.name,
				item: place.nodeName,
			},
			link: commentLink(place),
		});
	}
}
