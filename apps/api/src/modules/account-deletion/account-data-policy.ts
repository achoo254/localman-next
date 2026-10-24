/**
 * What deleting an account does to the documents of every model
 * (docs/decisions/0007-account-deletion.md). `account-data-policy.test.ts`
 * fails when a registered model is missing here, so a new model has to
 * decide before it ships.
 *
 * - `deleted`: the account's own rows go.
 * - `anonymized`: shared team content stays; the account's `sub` in it
 *   becomes `DELETED_USER` (or leaves a list), so signing in again later
 *   never reattaches it.
 * - `deletedAndAnonymized`: both, by field (own rows go, mentions of the
 *   account in other people's rows are anonymized).
 * - `withProject` / `withWorkspace`: removed by the cascade of the owned
 *   project or of the workspace the account deletes.
 * - `notPersonal`: holds nothing that identifies the account.
 * - `hashOnly`: the SHA-256 of the account id, kept after deletion.
 */
export type AccountDataHandling =
	| "deleted"
	| "anonymized"
	| "deletedAndAnonymized"
	| "withProject"
	| "withWorkspace"
	| "notPersonal"
	| "hashOnly";

export const ACCOUNT_DATA_POLICY: Readonly<
	Record<string, AccountDataHandling>
> = {
	// Identity and sign-in.
	User: "deleted",
	DeletedAccount: "hashOnly",
	Session: "deleted",
	// A pending native app sign-in (minutes): sealed IdP tokens of `sub`.
	MobileHandoff: "deleted",
	PushSubscription: "deleted",
	AuditEvent: "deleted",
	// Sign-in handshakes (10 minutes) and replay guards hold no `sub`.
	LoginTransaction: "notPersonal",
	LogoutTokenJti: "notPersonal",
	// Hashed keys that expire with their window.
	RateLimitWindow: "notPersonal",
	// Personal settings and history.
	Notification: "deleted",
	NotificationPreferences: "deleted",
	ClientHistory: "deleted",
	ClientDraft: "deleted",
	ClientSettings: "deleted",
	UsageCounter: "deleted",
	TrialExtension: "deletedAndAnonymized",
	Feedback: "deleted",
	ContactMessage: "deleted",
	TunnelLink: "deleted",
	LocalVariableValue: "deleted",
	// Vault parameters (salt, check ciphertext) of the person.
	SecretVault: "deleted",
	ActiveEnvironment: "deleted",
	CollectionFavorite: "deleted",
	CollectionWatch: "deleted",
	// Mock projects: owned ones are deleted with everything in them;
	// membership of other people's projects ends.
	Project: "withProject",
	Resource: "withProject",
	Record: "withProject",
	ResourceTreeLock: "withProject",
	RequestLog: "withProject",
	WebhookInbox: "withProject",
	CallbackConfig: "withProject",
	OutboundJob: "withProject",
	McpToken: "withProject",
	Collaborator: "deletedAndAnonymized",
	// Kept: the owner's record that a removed member may not rejoin.
	MemberRemoval: "anonymized",
	MagicLink: "anonymized",
	// Workspaces: the personal one and team ones the account is alone in
	// are deleted; in the others the account leaves and its authorship of
	// team content is anonymized.
	Workspace: "withWorkspace",
	WorkspaceLock: "deleted",
	WorkspaceMember: "deletedAndAnonymized",
	Collection: "anonymized",
	CollectionNode: "anonymized",
	CollectionRevision: "anonymized",
	CollectionComment: "anonymized",
	Environment: "anonymized",
	GlobalVariables: "anonymized",
	Fork: "anonymized",
	ForkBaseNode: "withWorkspace",
	// Who linked a collection to its mock; the base holds no account.
	LiveMockSyncLink: "anonymized",
	LiveMockSyncBaseNode: "notPersonal",
	// Who published a project's docs; the link goes with the project.
	ProjectDocsLink: "anonymized",
	PullRequest: "anonymized",
	ElementRole: "deletedAndAnonymized",
	AccessRequest: "deletedAndAnonymized",
	// Publishing the account made stops: it no longer holds a role.
	CollectionLink: "deleted",
	CollectionAccessKey: "deleted",
	RunButton: "deleted",
	RunButtonImport: "deleted",
};
