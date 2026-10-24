import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { MagicLinkModel } from "../collaborators/magic-link-model.js";
import { MemberRemovalModel } from "../collaborators/member-removal-model.js";
import { CollectionModel } from "../collections/collection-model.js";
import { CollectionNodeModel } from "../collections/collection-node-model.js";
import { CollectionRevisionModel } from "../collections/collection-revision-model.js";
import { CommentModel } from "../comments/comment-model.js";
import { EnvironmentModel } from "../environments/environment-model.js";
import { GlobalVariablesModel } from "../environments/global-variables-model.js";
import { SyncLinkModel } from "../live-mock-sync/sync-link-model.js";
import { DocsLinkModel } from "../project-docs/docs-link-model.js";
import { TrialExtensionModel } from "../trial/trial-extension-model.js";
import { ForkModel } from "../version-control/fork-model.js";
import { PullRequestModel } from "../version-control/pull-request-model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import type { ErasedCount } from "./account-own-rows.js";

/**
 * Who a deleted account becomes in team content it leaves behind
 * (comments, changelog, collections it created…). Not an IdP subject, so
 * no one signs in as it, owns it or is shown a name for it; the same
 * IdP account signing in again later does not get the content back.
 */
export const DELETED_USER = "deleted-user";

/**
 * `updatedAt` stays as it was: removing a name is not an edit of the
 * collection, node or comment, and sorting by it must not change.
 */
const KEEP_TIMESTAMPS = { timestamps: false } as const;

type Rewrite = (sub: string) => Promise<{ modifiedCount: number }>;

/** Sets `field` to `DELETED_USER` where it is the account. */
function replaceIn(
	update: (
		filter: Record<string, string>,
		set: Record<string, unknown>,
	) => Promise<{ modifiedCount: number }>,
	field: string,
): Rewrite {
	return (sub) => update({ [field]: sub }, { $set: { [field]: DELETED_USER } });
}

/** Removes the account from the `field` list. */
function pullFrom(
	update: (
		filter: Record<string, string>,
		set: Record<string, unknown>,
	) => Promise<{ modifiedCount: number }>,
	field: string,
): Rewrite {
	return (sub) => update({ [field]: sub }, { $pull: { [field]: sub } });
}

const collections = (f: Record<string, string>, u: Record<string, unknown>) =>
	CollectionModel.updateMany(f, u, KEEP_TIMESTAMPS);
const comments = (f: Record<string, string>, u: Record<string, unknown>) =>
	CommentModel.updateMany(f, u, KEEP_TIMESTAMPS);
const pullRequests = (f: Record<string, string>, u: Record<string, unknown>) =>
	PullRequestModel.updateMany(f, u, KEEP_TIMESTAMPS);
const environments = (f: Record<string, string>, u: Record<string, unknown>) =>
	EnvironmentModel.updateMany(f, u, KEEP_TIMESTAMPS);

/**
 * Every field of shared content that names the account, by collection.
 * Content the account wrote for a team (comments, collections, the
 * changelog) belongs to the team and stays; only the name goes.
 */
const REFERENCES: ReadonlyArray<readonly [string, Rewrite]> = [
	["collections.createdBy", replaceIn(collections, "createdBy")],
	["collections.updatedBy", replaceIn(collections, "updatedBy")],
	["collections.deletedBy", replaceIn(collections, "deletedBy")],
	["collections.trashEditors", pullFrom(collections, "trashEditors")],
	[
		"collection_nodes.updatedBy",
		replaceIn(
			(f, u) => CollectionNodeModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"updatedBy",
		),
	],
	[
		"collection_revisions.authorId",
		replaceIn((f, u) => CollectionRevisionModel.updateMany(f, u), "authorId"),
	],
	["collection_comments.authorId", replaceIn(comments, "authorId")],
	["collection_comments.resolvedBy", replaceIn(comments, "resolvedBy")],
	["collection_comments.mentions", pullFrom(comments, "mentions")],
	["environments.createdBy", replaceIn(environments, "createdBy")],
	["environments.updatedBy", replaceIn(environments, "updatedBy")],
	[
		"global_variables.updatedBy",
		replaceIn(
			(f, u) => GlobalVariablesModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"updatedBy",
		),
	],
	[
		"forks.createdBy",
		replaceIn(
			(f, u) => ForkModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"createdBy",
		),
	],
	[
		"live_mock_sync_links.createdBy",
		replaceIn(
			(f, u) => SyncLinkModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"createdBy",
		),
	],
	[
		"project_docs_links.createdBy",
		replaceIn(
			(f, u) => DocsLinkModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"createdBy",
		),
	],
	["pull_requests.authorId", replaceIn(pullRequests, "authorId")],
	["pull_requests.mergedBy", replaceIn(pullRequests, "mergedBy")],
	["pull_requests.notified", pullFrom(pullRequests, "notified")],
	["pull_requests.reviewers", anonymizeReviewer],
	[
		"workspace_members.invitedBy",
		replaceIn(
			(f, u) => WorkspaceMemberModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"invitedBy",
		),
	],
	[
		"element_roles.grantedBy",
		replaceIn(
			(f, u) => ElementRoleModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"grantedBy",
		),
	],
	[
		"access_requests.resolvedBy",
		replaceIn(
			(f, u) => AccessRequestModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"resolvedBy",
		),
	],
	[
		"collaborators.invitedBy",
		replaceIn(
			(f, u) => CollaboratorModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"invitedBy",
		),
	],
	[
		"magic_links.createdBy",
		replaceIn(
			(f, u) => MagicLinkModel.updateMany(f, u, KEEP_TIMESTAMPS),
			"createdBy",
		),
	],
	[
		"member_removals.removedBy",
		replaceIn((f, u) => MemberRemovalModel.updateMany(f, u), "removedBy"),
	],
	[
		"trial_extension_requests.decidedBy",
		replaceIn((f, u) => TrialExtensionModel.updateMany(f, u), "decidedBy"),
	],
];

/**
 * A reviewer entry becomes `DELETED_USER`, but a pull request keeps at
 * most one such entry: where one exists already (another deleted
 * reviewer), this account's entry is removed, so neither the list nor its
 * approvals hold the same anonymous reviewer twice.
 */
async function anonymizeReviewer(
	sub: string,
): Promise<{ modifiedCount: number }> {
	const dropped = await PullRequestModel.updateMany(
		{ "reviewers.userId": { $all: [sub, DELETED_USER] } },
		{ $pull: { reviewers: { userId: sub } } },
		KEEP_TIMESTAMPS,
	);
	const renamed = await PullRequestModel.updateMany(
		{ "reviewers.userId": sub },
		{ $set: { "reviewers.$[mine].userId": DELETED_USER } },
		{ ...KEEP_TIMESTAMPS, arrayFilters: [{ "mine.userId": sub }] },
	);
	return { modifiedCount: dropped.modifiedCount + renamed.modifiedCount };
}

/** Anonymizes the account in shared content; counts per field. */
export async function anonymizeReferences(sub: string): Promise<ErasedCount[]> {
	const counts: ErasedCount[] = [];
	for (const [field, rewrite] of REFERENCES) {
		const { modifiedCount } = await rewrite(sub);
		counts.push({ collection: field, count: modifiedCount });
	}
	return counts;
}
