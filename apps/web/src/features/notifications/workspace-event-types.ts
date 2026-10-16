import { useCommentsEnabled } from "../comments/use-comments-enabled";
import { useForksEnabled } from "../version-control/use-forks-enabled";
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

/** Notification types of pull requests, hidden while forks are off. */
export const FORK_EVENT_TYPES: ReadonlySet<string> = new Set([
	"pullRequest.opened",
	"pullRequest.reviewed",
	"pullRequest.merged",
]);

/** Whether a notification type belongs to a feature that is on. */
export function useShownEventType(): (type: string) => boolean {
	const workspaces = useWorkspacesEnabled();
	const comments = useCommentsEnabled();
	const forks = useForksEnabled();
	return (type) =>
		(workspaces || !WORKSPACE_EVENT_TYPES.has(type)) &&
		(comments || !COMMENT_EVENT_TYPES.has(type)) &&
		(forks || !FORK_EVENT_TYPES.has(type));
}
