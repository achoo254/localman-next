import { z } from "zod";
import {
	attemptView,
	toAttemptView,
} from "../mock-runtime/request-log-view.js";
import type { StoredDelivery } from "./outbound-send.js";

/**
 * The last delivery of a callback or inbox forward: `ok` when an answer
 * below 500 came, the last status (null when none came), its ms and every
 * attempt (`error`: `no_tunnel`, `connect`, `timeout`, `dns`, `blocked`,
 * `body_too_large`).
 */
export const deliveryView = z.object({
	at: z.string(),
	ok: z.boolean(),
	status: z.number().nullable(),
	ms: z.number(),
	attempts: z.array(attemptView),
});
export type DeliveryView = z.infer<typeof deliveryView>;

/** Stored as `Mixed`: anything malformed reads as no result. */
export function toDeliveryView(
	stored: StoredDelivery | null | undefined,
): DeliveryView | null {
	if (!stored || !(stored.at instanceof Date)) return null;
	return {
		at: stored.at.toISOString(),
		ok: stored.ok === true,
		status: typeof stored.status === "number" ? stored.status : null,
		ms: typeof stored.ms === "number" ? stored.ms : 0,
		attempts: Array.isArray(stored.attempts)
			? stored.attempts.map(toAttemptView)
			: [],
	};
}
