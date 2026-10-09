import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { UserModel } from "../users/user-model.js";
import {
	NOTIFICATION_EVENTS,
	NOTIFICATION_EVENT_TYPES,
} from "./notification-events.js";
import {
	type EventPreference,
	readEventPreferences,
	updateEventPreferences,
} from "./notification-preferences-model.js";
import { getNotificationService } from "./notification-runtime.js";
import { PushSubscriptionModel } from "./push-subscription-model.js";

const preferencesView = z.object({
	channels: z.object({
		webPush: z.object({ available: z.boolean(), enabled: z.boolean() }),
		telegram: z.object({
			available: z.boolean(),
			linked: z.boolean(),
			activated: z.boolean(),
			botUsername: z.string().nullable(),
		}),
	}),
	events: z.array(
		z.object({
			type: z.string(),
			label: z.string(),
			inApp: z.boolean(),
			webPush: z.boolean(),
			telegram: z.boolean(),
		}),
	),
});

type PreferencesView = z.input<typeof preferencesView>;

interface StoredTelegram {
	telegram?: { chatId?: string | null; blockedAt?: Date | null } | null;
}

const LABELS = new Map<string, string>(
	NOTIFICATION_EVENTS.map((event) => [event.type, event.label]),
);

/**
 * Channel state for the settings page. `webPush.enabled`: at least one of
 * the user's devices is subscribed. `telegram.activated`: linked and the
 * bot has not been refused (403) since the chat was linked.
 */
async function buildView(
	userSub: string,
	events: readonly EventPreference[],
): Promise<PreferencesView> {
	const availability = getNotificationService().availability;
	const [user, devices] = await Promise.all([
		UserModel.findOne({ sub: userSub })
			.select("telegram")
			.lean<StoredTelegram>(),
		PushSubscriptionModel.countDocuments({ userSub }),
	]);
	const linked = Boolean(user?.telegram?.chatId);
	return {
		channels: {
			webPush: { available: availability.webPush, enabled: devices > 0 },
			telegram: {
				available: availability.telegram,
				linked,
				activated: linked && !user?.telegram?.blockedAt,
				botUsername: availability.telegramBotUsername,
			},
		},
		events: events.map((event) => ({
			type: event.type,
			label: LABELS.get(event.type) ?? event.type,
			inApp: event.inApp,
			webPush: event.webPush,
			telegram: event.telegram,
		})),
	};
}

const description =
	"In-app (on by default), Web Push and Telegram (off by default) are chosen per event type.";

export const getNotificationPreferences = defineOperation({
	id: "notifications.getNotificationPreferences",
	method: "GET",
	path: "/notification-preferences",
	summary: "Get notification channels and per-event preferences",
	description,
	input: z.object({}),
	output: preferencesView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: true,
	handler: async (ctx) => {
		const userSub = requireSubject(ctx);
		return buildView(userSub, await readEventPreferences(userSub));
	},
});

export const updateNotificationPreferences = defineOperation({
	id: "notifications.updateNotificationPreferences",
	method: "PUT",
	path: "/notification-preferences",
	summary: "Choose in-app, Web Push and Telegram per notification event type",
	description: `${description} Omitted event types and fields keep their value. Turning Telegram on retries a bot that was not activated yet.`,
	input: z.object({
		events: z
			.array(
				z.object({
					type: z.enum(NOTIFICATION_EVENT_TYPES),
					inApp: z.boolean().optional(),
					webPush: z.boolean().optional(),
					telegram: z.boolean().optional(),
				}),
			)
			.max(NOTIFICATION_EVENTS.length * 2),
	}),
	output: preferencesView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: true,
	handler: async (ctx, input) => {
		const userSub = requireSubject(ctx);
		const events = await updateEventPreferences(userSub, input.events);
		if (input.events.some((event) => event.telegram === true)) {
			// The user may have pressed Start since the last 403: try again.
			await UserModel.updateOne(
				{ sub: userSub },
				{ $unset: { "telegram.blockedAt": 1 } },
			);
		}
		return buildView(userSub, events);
	},
});
