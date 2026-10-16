import { formatCount } from "../../i18n/server-messages.js";
import { COLLABORATION_PARAMS } from "./collaboration-params.js";
import { type Template, template } from "./notification-template.js";

/** Texts of the events of comments, watch and pull requests. */
export const COLLABORATION_TEMPLATES: Readonly<
	Record<keyof typeof COLLABORATION_PARAMS, Template>
> = {
	"comment.mentioned": template(
		COLLABORATION_PARAMS["comment.mentioned"],
		(params, { commentMentioned }) => ({
			title: commentMentioned.title,
			body: commentMentioned.body(params),
		}),
	),
	"comment.replied": template(
		COLLABORATION_PARAMS["comment.replied"],
		(params, { commentReplied }) => ({
			title: commentReplied.title,
			body: commentReplied.body(params),
		}),
	),
	"collection.changed": template(
		COLLABORATION_PARAMS["collection.changed"],
		(params, { collectionChanged }, locale) => ({
			title: collectionChanged.title,
			body: collectionChanged.body({
				...params,
				changes: formatCount(locale, params.changes),
				count: params.changes,
			}),
		}),
	),
	"pullRequest.opened": template(
		COLLABORATION_PARAMS["pullRequest.opened"],
		(params, { pullRequestOpened }) => ({
			title: pullRequestOpened.title,
			body: pullRequestOpened.body(params),
		}),
	),
	"pullRequest.reviewed": template(
		COLLABORATION_PARAMS["pullRequest.reviewed"],
		(params, { pullRequestReviewed }) => ({
			title:
				params.decision === "approved"
					? pullRequestReviewed.approvedTitle
					: pullRequestReviewed.declinedTitle,
			body:
				params.decision === "approved"
					? pullRequestReviewed.approvedBody(params)
					: pullRequestReviewed.declinedBody(params),
		}),
	),
	"pullRequest.merged": template(
		COLLABORATION_PARAMS["pullRequest.merged"],
		(params, { pullRequestMerged }) => ({
			title: pullRequestMerged.title,
			body: pullRequestMerged.body(params),
		}),
	),
};
