import type { AnyOperation } from "@localman/operations";
import {
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "../modules/notifications/notification-operations.js";
import {
	getNotificationPreferences,
	updateNotificationPreferences,
} from "../modules/notifications/preference-operations.js";
import {
	createPushSubscription,
	deletePushSubscription,
	getVapidPublicKey,
} from "../modules/notifications/push-operations.js";
import { getMe } from "../modules/users/user-operations.js";

/**
 * Every dashboard API operation. REST routes, MCP tools and the OpenAPI
 * document are generated from this list; business routes must be declared
 * here with `defineOperation`, never as hand-written Express routes.
 * Protocol routes outside the registry are listed in protocol-routes.ts.
 */
export const operations: readonly AnyOperation[] = [
	getMe,
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	getNotificationPreferences,
	updateNotificationPreferences,
	getVapidPublicKey,
	createPushSubscription,
	deletePushSubscription,
];
