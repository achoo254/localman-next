import { useCommentsEnabled } from "../comments/use-comments-enabled";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";

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

/** Notification types of comments and watch, hidden while they are off. */
export const COMMENT_EVENT_TYPES: ReadonlySet<string> = new Set([
	"comment.mentioned",
	"comment.replied",
	"collection.changed",
]);

/** Whether a notification type belongs to a feature that is on. */
export function useShownEventType(): (type: string) => boolean {
	const workspaces = useWorkspacesEnabled();
	const comments = useCommentsEnabled();
	return (type) =>
		(workspaces || !WORKSPACE_EVENT_TYPES.has(type)) &&
		(comments || !COMMENT_EVENT_TYPES.has(type));
}
