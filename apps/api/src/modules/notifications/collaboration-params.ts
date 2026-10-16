import { z } from "zod";
import { name } from "./notification-param-values.js";

/** A comment on a collection or on one of its items (`item` null: itself). */
const commentParams = z.object({
	author: name.nullable(),
	collection: name,
	item: name.nullable(),
});

/** A pull request: who acted on it, its title and its source collection. */
const pullRequestParams = z.object({
	author: name.nullable(),
	title: name,
	collection: name,
});

/** Params of the events of comments, watch and pull requests. */
export const COLLABORATION_PARAMS = {
	/** `author` is `null` for an account without name or username. */
	"comment.mentioned": commentParams,
	"comment.replied": commentParams,
	/** One per watcher and digest run; `author` only when one person changed it. */
	"collection.changed": z.object({
		collection: name,
		changes: z.number().int().min(1),
		authors: z.number().int().min(1),
		author: name.nullable(),
	}),
	/** To each reviewer; `author` is `null` without a name. */
	"pullRequest.opened": pullRequestParams,
	/** To its author. */
	"pullRequest.reviewed": pullRequestParams.extend({
		decision: z.enum(["approved", "declined"]),
	}),
	"pullRequest.merged": pullRequestParams,
};
