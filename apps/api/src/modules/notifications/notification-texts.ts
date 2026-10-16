import type { Locale } from "@localman/shared";
import { formatCount, messagesFor } from "../../i18n/server-messages.js";
import { COLLABORATION_TEMPLATES } from "./collaboration-texts.js";
import {
	NOTIFICATION_EVENT_TYPES,
	NOTIFICATION_PARAMS,
	type NotificationEventType,
	type NotificationType,
	TEST_NOTIFICATION_TYPE,
} from "./notification-events.js";
import {
	type NotificationText,
	type Template,
	template,
} from "./notification-template.js";

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
	"trial.ending": template(
		NOTIFICATION_PARAMS["trial.ending"],
		(params, { trial }) => {
			const text = {
				daysLeft: params.daysLeft,
				date: trial.formatDay(params.endsOn),
			};
			return { title: trial.endingTitle(text), body: trial.endingBody(text) };
		},
	),
	"trial.ended": template(
		NOTIFICATION_PARAMS["trial.ended"],
		(params, { trial }) => ({
			title: trial.endedTitle,
			body: trial.endedBody({ date: trial.formatDay(params.endsOn) }),
		}),
	),
	"trial.extension.requested": template(
		NOTIFICATION_PARAMS["trial.extension.requested"],
		(params, { trial }) => ({
			title: trial.requestedTitle,
			body: trial.requestedBody(params),
		}),
	),
	"trial.extension.approved": template(
		NOTIFICATION_PARAMS["trial.extension.approved"],
		(params, { trial }) => ({
			title: trial.approvedTitle,
			body: trial.approvedBody({ date: trial.formatDay(params.endsOn) }),
		}),
	),
	"trial.extension.declined": template(
		NOTIFICATION_PARAMS["trial.extension.declined"],
		(_params, { trial }) => ({
			title: trial.declinedTitle,
			body: trial.declinedBody,
		}),
	),
	"workspace.invitation": template(
		NOTIFICATION_PARAMS["workspace.invitation"],
		(params, { workspaceInvitation, roleNames }) => ({
			title: workspaceInvitation.title,
			body: workspaceInvitation.body({
				...params,
				role: roleNames[params.role],
			}),
		}),
	),
	"element.shared": template(
		NOTIFICATION_PARAMS["element.shared"],
		(params, { elementShared, roleNames, elementNames }) => ({
			title: elementShared.title,
			body: elementShared.body({
				sharer: params.sharer,
				element: params.element,
				kind: elementNames[params.elementType],
				role: roleNames[params.role],
			}),
		}),
	),
	"access.requested": template(
		NOTIFICATION_PARAMS["access.requested"],
		(params, { accessRequested, roleNames, elementNames }) => ({
			title: accessRequested.title,
			body: accessRequested.body({
				requester: params.requester,
				element: params.element,
				kind: elementNames[params.elementType],
				role: roleNames[params.role],
			}),
		}),
	),
	"access.resolved": template(
		NOTIFICATION_PARAMS["access.resolved"],
		(params, { accessResolved, roleNames, elementNames }) => {
			const text = {
				element: params.element,
				kind: elementNames[params.elementType],
				role: roleNames[params.role],
			};
			return params.approved
				? {
						title: accessResolved.approvedTitle,
						body: accessResolved.approvedBody(text),
					}
				: {
						title: accessResolved.deniedTitle,
						body: accessResolved.deniedBody(text),
					};
		},
	),
	...COLLABORATION_TEMPLATES,
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
