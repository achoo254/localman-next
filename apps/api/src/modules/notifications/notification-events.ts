/**
 * Every kind of notification Localman sends, with the label shown in the
 * channel settings. Modules add their events here (collaboration invites,
 * sharing, comments…); preferences are kept per event type and channel.
 */
export const NOTIFICATION_EVENTS = [
	{ type: "project.invitation", label: "Lời mời cộng tác project" },
	{ type: "usage.quota", label: "Cảnh báo hạn mức lượt gọi mock tháng" },
] as const;

export type NotificationEventType =
	(typeof NOTIFICATION_EVENTS)[number]["type"];

export const NOTIFICATION_EVENT_TYPES = NOTIFICATION_EVENTS.map(
	(event) => event.type,
) as [NotificationEventType, ...NotificationEventType[]];
