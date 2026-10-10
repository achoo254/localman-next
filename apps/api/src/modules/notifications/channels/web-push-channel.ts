import webpush from "web-push";
import type { Logger } from "../../../logger.js";
import { SessionModel } from "../../auth/session-model.js";
import { PushSubscriptionModel } from "../push-subscription-model.js";

export interface VapidConfig {
	readonly publicKey: string;
	readonly privateKey: string;
	/** `mailto:` or `https:` contact for push services. */
	readonly subject: string;
}

/** What the service worker receives (JSON) for one notification. */
export interface PushPayload {
	/** In-app notification id; `null` when the user turned in-app off. */
	readonly id: string | null;
	readonly type: string;
	readonly title: string;
	readonly body: string;
	readonly link: string | null;
}

/**
 * `sent`: at least one device accepted the message; `skipped`: no device of
 * a signed-in session; `failed`: every device refused it or was gone.
 */
export type WebPushDelivery = "sent" | "skipped" | "failed";

/** Sends one encrypted push message; the `web-push` library by default. */
export type PushSender = (
	subscription: webpush.PushSubscription,
	payload: string,
	options: webpush.RequestOptions,
) => Promise<unknown>;

/** Push services keep a message this long for an offline device. */
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const PUSH_TIMEOUT_MS = 10_000;

interface StoredSubscription {
	endpoint: string;
	sessionId?: string | null;
	keys: { p256dh: string; auth: string };
}

/** Sessions among the subscriptions' that are still signed in. */
async function liveSessionIds(
	subscriptions: readonly StoredSubscription[],
): Promise<Set<string>> {
	const ids = subscriptions.flatMap((s) => (s.sessionId ? [s.sessionId] : []));
	if (ids.length === 0) return new Set();
	const live: unknown[] = await SessionModel.find({
		_id: { $in: ids },
		expiresAt: { $gt: new Date() },
	}).distinct("_id");
	return new Set(live.filter((id): id is string => typeof id === "string"));
}

function statusCodeOf(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const status = "statusCode" in error ? error.statusCode : undefined;
	return typeof status === "number" ? status : undefined;
}

function endpointHost(endpoint: string): string {
	return URL.canParse(endpoint) ? new URL(endpoint).host : "invalid";
}

/**
 * Web Push with VAPID to every subscribed device of a user. A push
 * service answering 404 or 410 means the subscription is gone for good,
 * so it is deleted; other failures are logged and the device is kept.
 */
export class WebPushChannel {
	private readonly send: PushSender;

	constructor(
		private readonly vapid: VapidConfig,
		private readonly logger: Logger,
		send?: PushSender,
	) {
		this.send =
			send ??
			((sub, payload, options) =>
				webpush.sendNotification(sub, payload, options));
	}

	get publicKey(): string {
		return this.vapid.publicKey;
	}

	async deliver(
		userSub: string,
		payload: PushPayload,
	): Promise<WebPushDelivery> {
		const subscriptions = await PushSubscriptionModel.find({ userSub })
			.select("endpoint keys sessionId")
			.lean<StoredSubscription[]>();
		const live = await liveSessionIds(subscriptions);
		const orphaned = subscriptions.filter((s) => !live.has(s.sessionId ?? ""));
		if (orphaned.length > 0) {
			// Expired sessions vanish through a TTL index without a hook.
			await PushSubscriptionModel.deleteMany({
				endpoint: { $in: orphaned.map((s) => s.endpoint) },
			});
		}
		const devices = subscriptions.filter((s) => live.has(s.sessionId ?? ""));
		if (devices.length === 0) return "skipped";
		const body = JSON.stringify(payload);
		const accepted = await Promise.all(
			devices.map((subscription) => this.sendOne(subscription, body)),
		);
		return accepted.includes(true) ? "sent" : "failed";
	}

	/** Whether the push service accepted the message. */
	private async sendOne(
		subscription: StoredSubscription,
		body: string,
	): Promise<boolean> {
		try {
			await this.send(
				{ endpoint: subscription.endpoint, keys: subscription.keys },
				body,
				{
					vapidDetails: this.vapid,
					TTL: PUSH_TTL_SECONDS,
					timeout: PUSH_TIMEOUT_MS,
				},
			);
			return true;
		} catch (error) {
			const status = statusCodeOf(error);
			// The endpoint is a capability URL: log its host only.
			const host = endpointHost(subscription.endpoint);
			if (status === 404 || status === 410) {
				await PushSubscriptionModel.deleteOne({
					endpoint: subscription.endpoint,
				});
				this.logger.info(
					{ host, status },
					"Removed an expired push subscription",
				);
				return false;
			}
			this.logger.warn({ host, status }, "Web Push delivery failed");
			return false;
		}
	}
}
