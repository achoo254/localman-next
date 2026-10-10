import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import type { RateLimitWindow } from "../../config/runtime-settings.js";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { getNotificationService } from "./notification-runtime.js";
import { deliverTestNotification } from "./test-notification.js";

/** One test per user per minute: each sends real push and Telegram messages. */
export const TEST_NOTIFICATION_RATE_LIMIT: RateLimitWindow = {
	max: 1,
	windowMs: 60_000,
};

export const sendTestNotification = defineOperation({
	id: "notifications.sendTestNotification",
	method: "POST",
	path: "/notifications/test",
	summary: "Send a test notification to every ready channel",
	description:
		"Sends a test notification to the in-app bell and to every channel that is ready for the signed-in user, whatever the per-event preferences: Web Push when a device is subscribed and Web Push is enabled on the server, Telegram when the chat is linked and Telegram is enabled on the server; a chat whose bot was refused earlier (403) is tried again. Waits for each channel and returns its outcome: `inApp` is `sent`; `webPush` is `sent`, `skipped` (not ready) or `failed`; `telegram` is `sent`, `skipped` (not ready), `blocked` (Telegram refused the bot: press Start in it; the chat is marked blocked) or `failed`. At most one test per minute (429 `RATE_LIMITED`).",
	input: z.object({}),
	output: z.object({
		inApp: z.enum(["sent"]),
		webPush: z.enum(["sent", "skipped", "failed"]),
		telegram: z.enum(["sent", "skipped", "blocked", "failed"]),
	}),
	scopes: [USER_SCOPE],
	// Sends a new message every time; nothing is overwritten or removed.
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "notifications",
	mcp: true,
	handler: async (ctx) => {
		const userSub = requireSubject(ctx);
		const allowed = await takeRateLimitSlot(
			"notification-test:user",
			userSub,
			TEST_NOTIFICATION_RATE_LIMIT,
		);
		if (!allowed) {
			throw new OperationError(
				429,
				"RATE_LIMITED",
				"A test notification was sent less than a minute ago; wait and try again",
			);
		}
		return deliverTestNotification(getNotificationService(), userSub);
	},
});
