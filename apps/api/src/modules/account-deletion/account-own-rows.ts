import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { ClientSettingsModel } from "../api-client/client-settings-model.js";
import { DraftModel } from "../api-client/draft-model.js";
import { HistoryModel } from "../api-client/history-model.js";
import { AuditEventModel } from "../audit/audit-event-model.js";
import { SessionModel } from "../auth/session-model.js";
import { UsageCounterModel } from "../billing/usage-counter-model.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { MemberRemovalModel } from "../collaborators/member-removal-model.js";
import { CollectionFavoriteModel } from "../collections/collection-favorite-model.js";
import { ActiveEnvironmentModel } from "../environments/active-environment-model.js";
import { LocalVariableValueModel } from "../environments/local-variable-value-model.js";
import { ContactMessageModel } from "../feedback/contact-message-model.js";
import { FeedbackModel } from "../feedback/feedback-model.js";
import { NotificationModel } from "../notifications/notification-model.js";
import { NotificationPreferencesModel } from "../notifications/notification-preferences-model.js";
import { PushSubscriptionModel } from "../notifications/push-subscription-model.js";
import { CollectionAccessKeyModel } from "../public-sharing/collection-access-key-model.js";
import { CollectionLinkModel } from "../public-sharing/collection-link-model.js";
import { RunButtonImportModel } from "../public-sharing/run-button-import-model.js";
import { RunButtonModel } from "../public-sharing/run-button-model.js";
import { TrialExtensionModel } from "../trial/trial-extension-model.js";
import { CollectionWatchModel } from "../watch/watch-model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";

export interface ErasedCount {
	readonly collection: string;
	readonly count: number;
}

type Erase = (sub: string) => Promise<{ deletedCount: number }>;

/**
 * Rows that belong to the account alone, by collection. Each delete is
 * idempotent, so a deletion stopped half way is finished by running
 * again. Sessions are not here: they end first (`revokeSessions`).
 */
const OWN_ROWS: ReadonlyArray<readonly [string, Erase]> = [
	["notifications", (sub) => NotificationModel.deleteMany({ userSub: sub })],
	[
		"notification_preferences",
		(sub) => NotificationPreferencesModel.deleteMany({ userSub: sub }),
	],
	["client_history", (sub) => HistoryModel.deleteMany({ userSub: sub })],
	["client_drafts", (sub) => DraftModel.deleteMany({ userSub: sub })],
	[
		"client_settings",
		(sub) => ClientSettingsModel.deleteMany({ userSub: sub }),
	],
	["usage_counters", (sub) => UsageCounterModel.deleteMany({ ownerSub: sub })],
	[
		"trial_extension_requests",
		(sub) => TrialExtensionModel.deleteMany({ userSub: sub }),
	],
	[
		"feedback (pro interest)",
		(sub) => FeedbackModel.deleteMany({ type: "pro_interest", userSub: sub }),
	],
	[
		"feedback (contact)",
		(sub) => ContactMessageModel.deleteMany({ type: "contact", userSub: sub }),
	],
	["audit_events", (sub) => AuditEventModel.deleteMany({ sub })],
	[
		"local_variable_values",
		(sub) => LocalVariableValueModel.deleteMany({ userId: sub }),
	],
	[
		"active_environments",
		(sub) => ActiveEnvironmentModel.deleteMany({ userId: sub }),
	],
	[
		"collection_favorites",
		(sub) => CollectionFavoriteModel.deleteMany({ userId: sub }),
	],
	[
		"collection_watches",
		(sub) => CollectionWatchModel.deleteMany({ userId: sub }),
	],
	["element_roles", (sub) => ElementRoleModel.deleteMany({ userId: sub })],
	[
		"access_requests",
		(sub) => AccessRequestModel.deleteMany({ requesterId: sub }),
	],
	// Invitations to the account; accepted memberships are left or deleted
	// with their workspace (`account-workspaces.ts`).
	[
		"workspace_members (invitations)",
		(sub) =>
			WorkspaceMemberModel.deleteMany({ userId: sub, status: "pending" }),
	],
	// Membership of other people's mock projects ends.
	[
		"collaborators",
		(sub) => CollaboratorModel.deleteMany({ inviteeUserId: sub }),
	],
	["member_removals", (sub) => MemberRemovalModel.deleteMany({ userSub: sub })],
	// Publishing stops anyway once its creator holds no role.
	[
		"collection_links",
		(sub) => CollectionLinkModel.deleteMany({ createdBy: sub }),
	],
	[
		"collection_access_keys",
		(sub) => CollectionAccessKeyModel.deleteMany({ userId: sub }),
	],
	["run_buttons", (sub) => RunButtonModel.deleteMany({ createdBy: sub })],
	[
		"run_button_imports",
		(sub) => RunButtonImportModel.deleteMany({ userId: sub }),
	],
];

/** Deletes the account's own rows; counts per collection. */
export async function deleteOwnRows(sub: string): Promise<ErasedCount[]> {
	const counts: ErasedCount[] = [];
	for (const [collection, erase] of OWN_ROWS) {
		const { deletedCount } = await erase(sub);
		counts.push({ collection, count: deletedCount });
	}
	return counts;
}

/**
 * Ends every session of the account (and the Web Push devices they
 * registered): from here on its cookies authenticate nothing.
 */
export async function revokeSessions(sub: string): Promise<ErasedCount[]> {
	const sessions = await SessionModel.deleteMany({ sub });
	const devices = await PushSubscriptionModel.deleteMany({ userSub: sub });
	return [
		{ collection: "sessions", count: sessions.deletedCount },
		{ collection: "push_subscriptions", count: devices.deletedCount },
	];
}
