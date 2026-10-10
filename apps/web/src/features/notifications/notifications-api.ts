import type { ElementRole } from "@localman/shared/access";
import { apiRequest } from "../../lib/api-client";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import {
	type AccessRequestStatus,
	parseRequestStatus,
} from "../sharing/access-requests-api";
import { parseElementRole } from "../sharing/sharing-api";

export interface AppNotification {
	id: string;
	type: string;
	title: string;
	body: string;
	/** In-app path (or same-origin URL) opened when the item is chosen. */
	link: string | null;
	readAt: string | null;
	createdAt: string;
	/**
	 * `access.requested` items: the request with the role asked for now
	 * (`role`) and the role this notification announced (`notifiedRole`).
	 */
	accessRequest: {
		id: string;
		status: AccessRequestStatus;
		role: ElementRole;
		notifiedRole: ElementRole;
	} | null;
}

export interface NotificationPage {
	items: AppNotification[];
	nextCursor: string | null;
	unreadCount: number;
}

export const NOTIFICATION_PAGE_SIZE = 10;

function parseAccessRequestRef(
	value: unknown,
): AppNotification["accessRequest"] {
	// Absent from older API builds: a notification without a request.
	if (value === null || value === undefined) return null;
	const data = expectRecord(value, "access request");
	const role = parseElementRole(data.role, "access request role");
	return {
		id: expectString(data, "id"),
		status: parseRequestStatus(data.status),
		role,
		// Older API builds do not send it: the current role is the best guess.
		notifiedRole:
			data.notifiedRole === undefined
				? role
				: parseElementRole(data.notifiedRole, "notified role"),
	};
}

function parseNotification(value: unknown): AppNotification {
	const item = expectRecord(value, "notification");
	return {
		id: expectString(item, "id"),
		type: expectString(item, "type"),
		title: expectString(item, "title"),
		body: optionalString(item, "body") ?? "",
		link: optionalString(item, "link"),
		readAt: optionalString(item, "readAt"),
		createdAt: expectString(item, "createdAt"),
		accessRequest: parseAccessRequestRef(item.accessRequest),
	};
}

export function parseNotificationPage(data: unknown): NotificationPage {
	const page = expectRecord(data, "notification page");
	return {
		items: expectArray(page, "items").map(parseNotification),
		nextCursor: optionalString(page, "nextCursor"),
		unreadCount: expectNumber(page, "unreadCount"),
	};
}

export async function fetchNotifications(
	cursor: string | null,
): Promise<NotificationPage> {
	const params = new URLSearchParams({ limit: String(NOTIFICATION_PAGE_SIZE) });
	if (cursor) params.set("cursor", cursor);
	return parseNotificationPage(
		await apiRequest(`/api/v1/notifications?${params.toString()}`),
	);
}

export async function markNotificationRead(id: string): Promise<void> {
	await apiRequest(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
		method: "POST",
	});
}

export async function markAllNotificationsRead(): Promise<void> {
	await apiRequest("/api/v1/notifications/read-all", { method: "POST" });
}

/**
 * Router path for a notification link. Only same-origin targets are
 * followed, so a stored link can never send the user to another site.
 *
 * The URL parser resolves dot segments, so `/.//evil.com`, `/%2e//evil.com`
 * and `/..//evil.com` all come out as `//evil.com`, which the router would
 * treat as protocol-relative. The resolved path is therefore checked again.
 */
export function inAppPath(link: string | null): string | null {
	if (!link) return null;
	let url: URL;
	try {
		url = new URL(link, window.location.origin);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	if (url.pathname.startsWith("//") || url.pathname.startsWith("/\\")) {
		return null;
	}
	return `${url.pathname}${url.search}${url.hash}`;
}
