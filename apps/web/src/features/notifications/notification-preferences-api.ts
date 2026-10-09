import { type ApiRequestOptions, apiRequest } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** Delivery channels a user can pick per event type. */
export const EVENT_CHANNELS = ["inApp", "webPush", "telegram"] as const;
export type EventChannel = (typeof EVENT_CHANNELS)[number];

export interface EventPreference extends Record<EventChannel, boolean> {
	type: string;
	label: string;
}

export interface NotificationChannels {
	webPush: { available: boolean; enabled: boolean };
	telegram: {
		available: boolean;
		linked: boolean;
		activated: boolean;
		botUsername: string | null;
	};
}

export interface NotificationPreferences {
	channels: NotificationChannels;
	events: EventPreference[];
}

function parseEvent(value: unknown): EventPreference {
	const event = expectRecord(value, "event preference");
	return {
		type: expectString(event, "type"),
		label: expectString(event, "label"),
		inApp: expectBoolean(event, "inApp"),
		webPush: expectBoolean(event, "webPush"),
		telegram: expectBoolean(event, "telegram"),
	};
}

export function parsePreferences(data: unknown): NotificationPreferences {
	const root = expectRecord(data, "notification preferences");
	const channels = expectRecord(root.channels, "channels");
	const webPush: JsonRecord = expectRecord(channels.webPush, "webPush");
	const telegram: JsonRecord = expectRecord(channels.telegram, "telegram");
	return {
		channels: {
			webPush: {
				available: expectBoolean(webPush, "available"),
				enabled: expectBoolean(webPush, "enabled"),
			},
			telegram: {
				available: expectBoolean(telegram, "available"),
				linked: expectBoolean(telegram, "linked"),
				activated: expectBoolean(telegram, "activated"),
				botUsername: optionalString(telegram, "botUsername"),
			},
		},
		events: expectArray(root, "events").map(parseEvent),
	};
}

const PREFERENCES_PATH = "/api/v1/notification-preferences";

export async function fetchPreferences(): Promise<NotificationPreferences> {
	return parsePreferences(await apiRequest(PREFERENCES_PATH));
}

export async function savePreferences(
	events: EventPreference[],
): Promise<NotificationPreferences> {
	const body = {
		events: events.map(({ type, inApp, webPush, telegram }) => ({
			type,
			inApp,
			webPush,
			telegram,
		})),
	};
	return parsePreferences(
		await apiRequest(PREFERENCES_PATH, { method: "PUT", body }),
	);
}

/** Server VAPID key; `null` when Web Push is not configured server-side. */
export async function fetchVapidPublicKey(): Promise<string | null> {
	const data = expectRecord(
		await apiRequest("/api/v1/push/vapid-public-key"),
		"vapid key",
	);
	return optionalString(data, "publicKey");
}

export async function savePushSubscription(
	subscription: PushSubscriptionJSON,
): Promise<void> {
	await apiRequest("/api/v1/push-subscriptions", {
		method: "POST",
		body: subscription,
	});
}

export async function deletePushSubscription(
	endpoint: string,
	options: Pick<ApiRequestOptions, "redirectOnUnauthorized" | "signal"> = {},
): Promise<void> {
	await apiRequest("/api/v1/push-subscriptions", {
		...options,
		method: "DELETE",
		body: { endpoint },
	});
}

/** Telegram usernames: 5–32 of [A-Za-z0-9_]; anything else gets no link. */
export function telegramBotUrl(botUsername: string | null): string | null {
	return botUsername && /^[A-Za-z0-9_]{5,32}$/.test(botUsername)
		? `https://t.me/${botUsername}`
		: null;
}
