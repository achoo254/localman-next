import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import {
	USER_SCOPE,
	requireSession,
	requireSubject,
} from "../../http/require-auth.js";
import { getNotificationService } from "./notification-runtime.js";
import { PushSubscriptionModel } from "./push-subscription-model.js";

/** Devices kept per user; the oldest subscription goes first. */
const MAX_SUBSCRIPTIONS_PER_USER = 20;

/**
 * The server POSTs to the subscription endpoint, so only browser push
 * services are accepted (no request to arbitrary hosts): Chrome/FCM,
 * Firefox, Edge/WNS and Safari.
 */
const PUSH_SERVICE_HOSTS = [
	"fcm.googleapis.com",
	"android.googleapis.com",
	"push.services.mozilla.com",
	"notify.windows.com",
	"push.apple.com",
];

function isPushServiceEndpoint(value: string): boolean {
	if (!URL.canParse(value)) return false;
	const url = new URL(value);
	return (
		url.protocol === "https:" &&
		PUSH_SERVICE_HOSTS.some(
			(host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
		)
	);
}

const base64url = (min: number, max: number) =>
	z
		.string()
		.min(min)
		.max(max)
		.regex(/^[A-Za-z0-9_-]+=*$/, "must be base64url");

const endpoint = z
	.string()
	.max(2048)
	.refine(isPushServiceEndpoint, "must be a browser push service URL");

const BROWSER_ONLY =
	"Web Push subscriptions are created by a browser's service worker; an agent has no push endpoint or VAPID key use";

export const getVapidPublicKey = defineOperation({
	id: "notifications.getVapidPublicKey",
	method: "GET",
	path: "/push/vapid-public-key",
	summary: "VAPID public key for PushManager.subscribe, or null when disabled",
	input: z.object({}),
	output: z.object({ publicKey: z.string().nullable() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: { exempt: BROWSER_ONLY },
	handler: () => ({
		publicKey: getNotificationService().availability.vapidPublicKey,
	}),
});

export const createPushSubscription = defineOperation({
	id: "notifications.createPushSubscription",
	method: "POST",
	path: "/push-subscriptions",
	summary:
		"Register this browser for Web Push (body: PushSubscription.toJSON())",
	input: z.object({
		endpoint,
		expirationTime: z.number().int().nonnegative().nullable().optional(),
		keys: z.object({ p256dh: base64url(80, 100), auth: base64url(16, 32) }),
	}),
	output: z.object({ subscribed: z.literal(true) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: { exempt: BROWSER_ONLY },
	successStatus: 201,
	handler: async (ctx, input) => {
		const { sub: userSub, sessionId } = requireSession(ctx);
		if (!getNotificationService().availability.webPush) {
			throw new OperationError(
				409,
				"WEB_PUSH_UNAVAILABLE",
				"Web Push is not enabled on this server",
			);
		}
		const owner = { userSub, sessionId, keys: input.keys };
		await PushSubscriptionModel.updateOne(
			{ endpoint: input.endpoint },
			typeof input.expirationTime === "number"
				? {
						$set: { ...owner, expirationTime: new Date(input.expirationTime) },
					}
				: { $set: owner, $unset: { expirationTime: 1 } },
			{ upsert: true },
		);
		const stale = await PushSubscriptionModel.find({ userSub })
			.sort({ updatedAt: -1 })
			.skip(MAX_SUBSCRIPTIONS_PER_USER)
			.select("_id")
			.lean();
		if (stale.length > 0) {
			await PushSubscriptionModel.deleteMany({
				_id: { $in: stale.map((doc) => doc._id) },
			});
		}
		return { subscribed: true as const };
	},
});

export const deletePushSubscription = defineOperation({
	id: "notifications.deletePushSubscription",
	method: "DELETE",
	path: "/push-subscriptions",
	summary: "Stop Web Push to this browser",
	input: z.object({ endpoint: z.string().min(1).max(2048) }),
	output: z.object({ removed: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => {
		const result = await PushSubscriptionModel.deleteOne({
			endpoint: input.endpoint,
			userSub: requireSubject(ctx),
		});
		return { removed: result.deletedCount === 1 };
	},
});
