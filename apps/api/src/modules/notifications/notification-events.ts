import { z } from "zod";
import { normalizeInternalPath } from "../../http/internal-path.js";

/**
 * Every kind of event notification Localman sends. Modules add their events
 * here (and their texts and settings label in `src/i18n/messages/*`);
 * preferences are kept per event type and channel.
 */
export const NOTIFICATION_EVENT_TYPES = [
	"project.invitation",
	"project.mockUrlChanged",
	"usage.quota",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/**
 * The notification a user sends themselves from the settings page to check
 * their channels. It goes to every ready channel whatever the preferences,
 * so it is not an event type: no row in the preferences, no label.
 */
export const TEST_NOTIFICATION_TYPE = "notification.test";

/** Every type the bell stores: the event types and the test. */
export const NOTIFICATION_TYPES = [
	...NOTIFICATION_EVENT_TYPES,
	TEST_NOTIFICATION_TYPE,
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A name shown inside a sentence (project, person). */
const name = z.string().trim().min(1).max(200);

/**
 * What is stored with a notification, per event type. Texts are rendered
 * from these values in the reader's language, every time they are read,
 * so changing language also changes notifications already received.
 */
export const NOTIFICATION_PARAMS = {
	"project.invitation": z.object({
		/** `null` when the inviter has no name or username. */
		inviter: name.nullable(),
		project: name,
		days: z.number().int().min(1).max(365),
	}),
	"project.mockUrlChanged": z.object({ project: name }),
	"usage.quota": z.object({
		threshold: z.number().int().min(1).max(100),
		limit: z.number().int().min(1),
		used: z.number().int().min(0),
		/** `YYYYMM` of the counted month. */
		month: z.string().regex(/^\d{4}(0[1-9]|1[0-2])$/),
	}),
	// No values; Mongo drops an empty object, so a stored test has none.
	[TEST_NOTIFICATION_TYPE]: z.object({}).optional(),
} satisfies Record<NotificationType, z.ZodType>;

export type NotificationParams<T extends NotificationType> = z.output<
	(typeof NOTIFICATION_PARAMS)[T]
>;

type EventOf<T extends NotificationType> = {
	readonly type: T;
	readonly params: z.input<(typeof NOTIFICATION_PARAMS)[T]>;
	/** Path inside the dashboard, e.g. `/projects/abc`. */
	readonly link?: string;
};

/** What a module hands to the notification service. */
export type NotificationEvent = {
	[T in NotificationEventType]: EventOf<T>;
}[NotificationEventType];

/** An event or the test: anything the bell can store. */
export type AnyNotificationEvent = {
	[T in NotificationType]: EventOf<T>;
}[NotificationType];

/** An event `validateEvent` accepted: what the bell stores. */
export interface ValidatedEvent {
	readonly type: NotificationType;
	readonly params: unknown;
	/** Normalized path inside the dashboard. */
	readonly link?: string;
}

const internalLink = z.string().transform((value, ctx) => {
	const path = normalizeInternalPath(value);
	if (path === null) {
		ctx.addIssue({ code: "custom", message: "must be a path on this site" });
		return z.NEVER;
	}
	return path;
});

/** Checks the type, its params and the link (normalized) of an event. */
export function validateEvent(event: AnyNotificationEvent): ValidatedEvent {
	const type = z.enum(NOTIFICATION_TYPES).parse(event.type);
	const params: unknown = NOTIFICATION_PARAMS[type].parse(event.params);
	return event.link === undefined
		? { type, params }
		: { type, params, link: internalLink.parse(event.link) };
}
