import { z } from "zod";
import {
	deliveryView,
	toDeliveryView,
} from "../mock-callbacks/delivery-view.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import type { StoredInbox } from "./inbox-model.js";
import {
	INBOX_SEGMENT,
	forwardLabel,
	inboxContentTypeOf,
} from "./inbox-schema.js";

/** One inbox as the dashboard and agents see it. */
export const inboxView = z.object({
	id: z.string(),
	name: z.string(),
	/** Public URL senders post to: `{mock base}/_inbox/<name>`. */
	url: z.string(),
	response: z.object({
		status: z.number(),
		contentType: z.string(),
		body: z.string(),
	}),
	/** `null`: not forwarded. `target` reads `tunnel:<port><path>`. */
	forward: z
		.object({ port: z.number(), path: z.string(), target: z.string() })
		.nullable(),
	/** How the last forward ended; null before the first one. */
	lastForward: deliveryView.nullable(),
	/** Requests of this inbox still in the request log. */
	requestCount: z.number(),
	createdAt: z.string(),
});
export type InboxView = z.infer<typeof inboxView>;

/** The public URL of an inbox (outside the project prefix). */
export function inboxUrlOf(secret: string, name: string): string {
	return mockBaseUrlOf(secret, `/${INBOX_SEGMENT}/${name}`);
}

export function toInboxView(
	inbox: StoredInbox,
	secret: string,
	requestCount: number,
): InboxView {
	const { forward } = inbox;
	return {
		id: inbox._id.toHexString(),
		name: inbox.name,
		url: inboxUrlOf(secret, inbox.name),
		response: {
			status: inbox.response.status,
			contentType: inboxContentTypeOf(inbox.response.contentType),
			body: inbox.response.body,
		},
		forward: forward
			? {
					port: forward.port,
					path: forward.path,
					target: forwardLabel(forward),
				}
			: null,
		lastForward: toDeliveryView(inbox.lastForward),
		requestCount,
		createdAt: inbox.createdAt.toISOString(),
	};
}
