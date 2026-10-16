import type { NotificationEvent } from "../notifications/notification-events.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { displayNames } from "../users/display-names.js";
import type { StoredPullRequest } from "./pull-request-model.js";

export type PullRequestNotice =
	| { readonly type: "pullRequest.opened" | "pullRequest.merged" }
	| {
			readonly type: "pullRequest.reviewed";
			readonly decision: "approved" | "declined";
	  };

function eventOf(
	notice: PullRequestNotice,
	params: { author: string | null; title: string; collection: string },
	link: string,
): NotificationEvent {
	return notice.type === "pullRequest.reviewed"
		? {
				type: notice.type,
				params: { ...params, decision: notice.decision },
				link,
			}
		: { type: notice.type, params, link };
}

/**
 * Tells each recipient (never the actor) about the pull request, linking
 * to it on its source collection.
 */
export async function tellAboutPullRequest(
	recipients: readonly string[],
	notice: PullRequestNotice,
	actor: string,
	pr: StoredPullRequest,
	collection: string,
): Promise<void> {
	const targets = recipients.filter((sub) => sub !== actor);
	if (targets.length === 0) return;
	const author = (await displayNames([actor])).get(actor) ?? null;
	const link = `/elements/collection/${pr.sourceId.toHexString()}?pr=${pr._id.toHexString()}`;
	const event = eventOf(notice, { author, title: pr.title, collection }, link);
	for (const sub of targets) getNotificationService().notifyLater(sub, event);
}
