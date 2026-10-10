/**
 * Notification types of workspaces and sharing. While that feature is off
 * they are hidden from the bell and from the notification settings.
 */
export const WORKSPACE_EVENT_TYPES: ReadonlySet<string> = new Set([
	"workspace.invitation",
	"element.shared",
	"access.requested",
	"access.resolved",
]);
