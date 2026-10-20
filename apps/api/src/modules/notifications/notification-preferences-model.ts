import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import {
	NOTIFICATION_EVENT_TYPES,
	type NotificationEventType,
} from "./notification-events.js";

/**
 * Which channels a user wants per event type. In-app (the bell) starts on;
 * Web Push and Telegram start off until the user turns them on.
 */
const notificationPreferencesSchema = new Schema(
	{
		userSub: { type: String, required: true, unique: true },
		events: [
			{
				_id: false,
				type: {
					type: String,
					enum: [...NOTIFICATION_EVENT_TYPES],
					required: true,
				},
				inApp: { type: Boolean, required: true, default: true },
				webPush: { type: Boolean, required: true, default: false },
				telegram: { type: Boolean, required: true, default: false },
			},
		],
	},
	{
		collection: "notification_preferences",
		timestamps: true,
		versionKey: false,
	},
);

notificationPreferencesSchema.plugin(tenantScopePlugin);
export const NotificationPreferencesModel = mongoose.model(
	"NotificationPreferences",
	notificationPreferencesSchema,
);

export interface ChannelChoice {
	readonly inApp: boolean;
	readonly webPush: boolean;
	readonly telegram: boolean;
}

export interface EventPreference extends ChannelChoice {
	readonly type: NotificationEventType;
}

export interface EventPreferenceChange {
	readonly type: NotificationEventType;
	readonly inApp?: boolean;
	readonly webPush?: boolean;
	readonly telegram?: boolean;
}

const DEFAULT_CHOICE: ChannelChoice = {
	inApp: true,
	webPush: false,
	telegram: false,
};

interface StoredPreferences {
	events?: {
		type: string;
		inApp?: boolean;
		webPush: boolean;
		telegram: boolean;
	}[];
}

/** Stored choices merged over the defaults, one entry per known event type. */
export async function readEventPreferences(
	userSub: string,
): Promise<EventPreference[]> {
	const stored = await NotificationPreferencesModel.findOne({ userSub })
		.select("events")
		.lean<StoredPreferences>();
	const byType = new Map((stored?.events ?? []).map((e) => [e.type, e]));
	return NOTIFICATION_EVENT_TYPES.map((type) => {
		const choice = byType.get(type);
		return {
			type,
			// Documents stored before in-app became a choice lack the field.
			inApp: choice?.inApp ?? DEFAULT_CHOICE.inApp,
			webPush: choice?.webPush ?? DEFAULT_CHOICE.webPush,
			telegram: choice?.telegram ?? DEFAULT_CHOICE.telegram,
		};
	});
}

export async function channelChoiceFor(
	userSub: string,
	type: NotificationEventType,
): Promise<ChannelChoice> {
	const events = await readEventPreferences(userSub);
	return events.find((event) => event.type === type) ?? DEFAULT_CHOICE;
}

/** Applies partial changes and stores the full list. */
export async function updateEventPreferences(
	userSub: string,
	changes: readonly EventPreferenceChange[],
): Promise<EventPreference[]> {
	const current = await readEventPreferences(userSub);
	const next = current.map((event) => {
		const change = changes.find((candidate) => candidate.type === event.type);
		return {
			type: event.type,
			inApp: change?.inApp ?? event.inApp,
			webPush: change?.webPush ?? event.webPush,
			telegram: change?.telegram ?? event.telegram,
		};
	});
	await NotificationPreferencesModel.updateOne(
		{ userSub },
		{ $set: { events: next } },
		{ upsert: true },
	);
	return next;
}
