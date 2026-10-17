import type { AnyOperation } from "@localman/operations";
import { accessOperations } from "../modules/access/access-operations.js";
import { clientStoreOperations } from "../modules/api-client/client-store-operations.js";
import { proxyOperations } from "../modules/api-client/proxy-operations.js";
import { getAccountUsage } from "../modules/billing/usage-operations.js";
import { collaboratorOperations } from "../modules/collaborators/collaborator-operations.js";
import { inviteOperations } from "../modules/collaborators/invite-operations.js";
import { magicLinkOperations } from "../modules/collaborators/magic-link-operations.js";
import { collectionOperations } from "../modules/collections/collection-operations.js";
import { commentOperations } from "../modules/comments/comment-operations.js";
import { environmentOperations } from "../modules/environments/environment-operations.js";
import { environmentTransferOperations } from "../modules/environments/environment-transfer-operations.js";
import { globalsOperations } from "../modules/environments/globals-operations.js";
import { variableScopeOperations } from "../modules/environments/variable-scope-operations.js";
import { contactMessageAdminOperations } from "../modules/feedback/contact-message-admin-operations.js";
import { submitContactMessage } from "../modules/feedback/contact-message-operations.js";
import { proInterestAdminOperations } from "../modules/feedback/pro-interest-admin-operations.js";
import {
	getProInterestFormConfig,
	submitProInterest,
} from "../modules/feedback/pro-interest-operations.js";
import { mcpTokenOperations } from "../modules/mcp/mcp-token-operations.js";
import { callbackOperations } from "../modules/mock-callbacks/callback-operations.js";
import { trafficOperations } from "../modules/mock-runtime/traffic-operations.js";
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
import { sendTestNotification } from "../modules/notifications/test-notification-operations.js";
import { projectOperations } from "../modules/projects/project-operations.js";
import { rotateProjectSecret } from "../modules/projects/project-secret-operations.js";
import { publicSharingOperations } from "../modules/public-sharing/public-sharing-operations.js";
import { mockAdvancedOperations } from "../modules/resources/mock-advanced-operations.js";
import { getMockUrls } from "../modules/resources/mock-url-operations.js";
import { resourceDataOperations } from "../modules/resources/resource-data-operations.js";
import { createResourceFromSchema } from "../modules/resources/resource-import-operations.js";
import { resourceOperations } from "../modules/resources/resource-operations.js";
import { resourceTreeOperations } from "../modules/resources/resource-tree-operations.js";
import { getTenantInfo } from "../modules/tenant-info/tenant-info-operation.js";
import { trialAdminOperations } from "../modules/trial/trial-admin-operations.js";
import { trialOperations } from "../modules/trial/trial-operations.js";
import { tuneloOperations } from "../modules/tunelo/tunelo-operations.js";
import { getMe, setLocale } from "../modules/users/user-operations.js";
import { forkOperations } from "../modules/version-control/fork-operations.js";
import { watchOperations } from "../modules/watch/watch-operations.js";
import { webhookInboxOperations } from "../modules/webhook-inbox/inbox-operations.js";
import { workspaceOperations } from "../modules/workspaces/workspace-operations.js";

/**
 * Every dashboard API operation. REST routes, MCP tools and the OpenAPI
 * document are generated from this list; business routes must be declared
 * here with `defineOperation`, never as hand-written Express routes.
 * Protocol routes outside the registry are listed in protocol-routes.ts.
 */
export const operations: readonly AnyOperation[] = [
	getMe,
	setLocale,
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	getNotificationPreferences,
	updateNotificationPreferences,
	getVapidPublicKey,
	createPushSubscription,
	deletePushSubscription,
	sendTestNotification,
	...projectOperations,
	rotateProjectSecret,
	...mcpTokenOperations,
	...collaboratorOperations,
	...inviteOperations,
	...magicLinkOperations,
	...resourceOperations,
	createResourceFromSchema,
	...mockAdvancedOperations,
	...trafficOperations,
	...webhookInboxOperations,
	...callbackOperations,
	...proxyOperations,
	...clientStoreOperations,
	// Served only while TUNELO_ACCOUNTS_ENABLED is on (`feature-gates.ts`).
	...tuneloOperations,
	...workspaceOperations,
	...accessOperations,
	...collectionOperations,
	...commentOperations,
	...watchOperations,
	// Served only while FORKS_ENABLED is on (`feature-gates.ts`).
	...forkOperations,
	...environmentOperations,
	...environmentTransferOperations,
	...globalsOperations,
	...variableScopeOperations,
	...resourceTreeOperations,
	...resourceDataOperations,
	getMockUrls,
	getAccountUsage,
	...trialOperations,
	...trialAdminOperations,
	submitProInterest,
	getProInterestFormConfig,
	...proInterestAdminOperations,
	submitContactMessage,
	...contactMessageAdminOperations,
	getTenantInfo,
	// Served only while PUBLIC_SHARING_ENABLED is on (`feature-gates.ts`).
	...publicSharingOperations,
];
