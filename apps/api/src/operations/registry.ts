import type { AnyOperation } from "@localman/operations";
import { getAccountUsage } from "../modules/billing/usage-operations.js";
import { proInterestAdminOperations } from "../modules/feedback/pro-interest-admin-operations.js";
import {
	getProInterestFormConfig,
	submitProInterest,
} from "../modules/feedback/pro-interest-operations.js";
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
import { projectOperations } from "../modules/projects/project-operations.js";
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
	...projectOperations,
	getAccountUsage,
	submitProInterest,
	getProInterestFormConfig,
	...proInterestAdminOperations,
];
