import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	listNotifications as listInbox,
	markAllNotificationsRead as markAllInboxRead,
	markNotificationRead as markInboxRead,
} from "./channels/in-app-channel.js";

const MAX_PAGE_SIZE = 50;

const notificationItem = z.object({
	id: z.string(),
	type: z.string(),
	title: z.string(),
	body: z.string(),
	link: z.string().nullable(),
	readAt: z.string().nullable(),
	createdAt: z.string(),
});

export const listNotifications = defineOperation({
	id: "notifications.listNotifications",
	method: "GET",
	path: "/notifications",
	summary: "List the signed-in user's notifications, newest first",
	description:
		"Paginated with `cursor` (the `nextCursor` of the previous page). Also returns the number of unread notifications.",
	input: z.object({
		cursor: z
			.string()
			.regex(/^[a-f0-9]{24}$/, "must be a notification id")
			.optional(),
		limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
	}),
	output: z.object({
		items: z.array(notificationItem),
		nextCursor: z.string().nullable(),
		unreadCount: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: true,
	handler: (ctx, input) => listInbox(requireSubject(ctx), input),
});

export const markNotificationRead = defineOperation({
	id: "notifications.markNotificationRead",
	method: "POST",
	path: "/notifications/:notificationId/read",
	summary: "Mark one notification as read",
	input: z.object({ notificationId: z.string().min(1).max(64) }),
	output: notificationItem,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: true,
	handler: async (ctx, input) => {
		const item = await markInboxRead(requireSubject(ctx), input.notificationId);
		if (!item) {
			throw new OperationError(404, "NOT_FOUND", "Notification not found");
		}
		return item;
	},
});

export const markAllNotificationsRead = defineOperation({
	id: "notifications.markAllNotificationsRead",
	method: "POST",
	path: "/notifications/read-all",
	summary: "Mark every notification of the signed-in user as read",
	input: z.object({}),
	output: z.object({ updatedCount: z.number().int() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "notifications",
	mcp: true,
	handler: async (ctx) => ({
		updatedCount: await markAllInboxRead(requireSubject(ctx)),
	}),
});
