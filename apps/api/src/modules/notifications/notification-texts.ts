import type { Locale } from "@localman/shared";
import type { z } from "zod";
import {
	type ServerMessages,
	formatCount,
	messagesFor,
} from "../../i18n/server-messages.js";
import {
	NOTIFICATION_EVENT_TYPES,
	NOTIFICATION_PARAMS,
	type NotificationEventType,
	type NotificationType,
	TEST_NOTIFICATION_TYPE,
} from "./notification-events.js";

/** Title and body of one notification in one language. */
export interface NotificationText {
	readonly title: string;
	readonly body: string;
}

type Template = (params: unknown, locale: Locale) => NotificationText | null;

/** Validates stored params against `schema` before rendering them. */
function template<S extends z.ZodType>(
	schema: S,
	render: (
		params: z.output<S>,
		messages: ServerMessages,
		locale: Locale,
	) => NotificationText,
): Template {
	return (params, locale) => {
		const parsed = schema.safeParse(params);
		return parsed.success
			? render(parsed.data, messagesFor(locale), locale)
			: null;
	};
}

const TEMPLATES: Readonly<Record<NotificationType, Template>> = {
	"project.invitation": template(
		NOTIFICATION_PARAMS["project.invitation"],
		(params, { invitation }) => ({
			title: invitation.title,
			body: invitation.body(params),
		}),
	),
	"project.mockUrlChanged": template(
		NOTIFICATION_PARAMS["project.mockUrlChanged"],
		(params, { mockUrlChanged }) => ({
			title: mockUrlChanged.title,
			body: mockUrlChanged.body(params),
		}),
	),
	"usage.quota": template(
		NOTIFICATION_PARAMS["usage.quota"],
		(params, messages, locale) => {
			const { quota } = messages;
			const text = {
				threshold: params.threshold,
				used: formatCount(locale, params.used),
				limit: formatCount(locale, params.limit),
				month: messages.formatMonth(
					Number(params.month.slice(0, 4)),
					Number(params.month.slice(4)),
				),
			};
			return params.threshold >= 100
				? { title: quota.usedUpTitle, body: quota.usedUpBody(text) }
				: { title: quota.warningTitle(text), body: quota.warningBody(text) };
		},
	),
	[TEST_NOTIFICATION_TYPE]: template(
		NOTIFICATION_PARAMS[TEST_NOTIFICATION_TYPE],
		(_params, { testNotification }) => testNotification,
	),
};

function isNotificationType(type: string): type is NotificationType {
	return Object.hasOwn(TEMPLATES, type);
}

function isEventType(type: string): type is NotificationEventType {
	return NOTIFICATION_EVENT_TYPES.some((eventType) => eventType === type);
}

/**
 * Texts of a notification in `locale`; `null` when the type is unknown or
 * the params do not fit it (a record from an older format).
 */
export function renderNotification(
	type: string,
	params: unknown,
	locale: Locale,
): NotificationText | null {
	return isNotificationType(type) ? TEMPLATES[type](params, locale) : null;
}

/** Label of an event type on the notification settings page. */
export function eventLabel(type: string, locale: Locale): string {
	const labels = messagesFor(locale).eventLabels;
	return isEventType(type) ? labels[type] : type;
}
