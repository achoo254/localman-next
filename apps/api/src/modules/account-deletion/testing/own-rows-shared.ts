import { Types } from "mongoose";
import { AccessRequestModel } from "../../access/access-request-model.js";
import { ElementRoleModel } from "../../access/element-role-model.js";
import { CollaboratorModel } from "../../collaborators/collaborator-model.js";
import { MemberRemovalModel } from "../../collaborators/member-removal-model.js";
import { CollectionFavoriteModel } from "../../collections/collection-favorite-model.js";
import { ActiveEnvironmentModel } from "../../environments/active-environment-model.js";
import { LocalVariableValueModel } from "../../environments/local-variable-value-model.js";
import { CollectionAccessKeyModel } from "../../public-sharing/collection-access-key-model.js";
import { CollectionLinkModel } from "../../public-sharing/collection-link-model.js";
import { RunButtonImportModel } from "../../public-sharing/run-button-import-model.js";
import { RunButtonModel } from "../../public-sharing/run-button-model.js";
import { TunnelLinkModel } from "../../tunelo/tunelo-link-model.js";
import { CollectionWatchModel } from "../../watch/watch-model.js";
import { WorkspaceMemberModel } from "../../workspaces/workspace-member-model.js";
import type { OwnRow } from "./own-rows-fixture.js";

/** TEST ONLY. Rows tying the account to shared things (roles, links, keys). */
export const SHARED_ROWS: readonly OwnRow[] = [
	[
		"local_variable_values",
		(sub) =>
			LocalVariableValueModel.create({
				userId: sub,
				scope: "global:x",
				key: "token",
				value: "v",
			}),
		(sub) => LocalVariableValueModel.countDocuments({ userId: sub }),
	],
	[
		"active_environments",
		(sub) =>
			ActiveEnvironmentModel.create({
				userId: sub,
				workspaceId: new Types.ObjectId(),
				environmentId: new Types.ObjectId(),
			}),
		(sub) => ActiveEnvironmentModel.countDocuments({ userId: sub }),
	],
	[
		"collection_favorites",
		(sub) =>
			CollectionFavoriteModel.create({
				userId: sub,
				collectionId: new Types.ObjectId(),
			}),
		(sub) => CollectionFavoriteModel.countDocuments({ userId: sub }),
	],
	[
		"collection_watches",
		(sub) =>
			CollectionWatchModel.create({
				userId: sub,
				collectionId: new Types.ObjectId(),
			}),
		(sub) => CollectionWatchModel.countDocuments({ userId: sub }),
	],
	[
		"element_roles",
		(sub) =>
			ElementRoleModel.create({
				elementType: "collection",
				elementId: new Types.ObjectId().toHexString(),
				userId: sub,
				role: "viewer",
				grantedBy: "acc_someone",
			}),
		(sub) => ElementRoleModel.countDocuments({ userId: sub }),
	],
	[
		"access_requests",
		(sub) =>
			AccessRequestModel.create({
				elementType: "collection",
				elementId: new Types.ObjectId().toHexString(),
				requesterId: sub,
				role: "viewer",
				status: "pending",
			}),
		(sub) => AccessRequestModel.countDocuments({ requesterId: sub }),
	],
	[
		"workspace_members (invitations)",
		(sub) =>
			WorkspaceMemberModel.create({
				workspaceId: new Types.ObjectId(),
				userId: sub,
				role: "viewer",
				status: "pending",
				invitedBy: "acc_someone",
			}),
		(sub) =>
			WorkspaceMemberModel.countDocuments({ userId: sub, status: "pending" }),
	],
	[
		"collaborators",
		(sub) =>
			CollaboratorModel.create({
				projectId: new Types.ObjectId(),
				inviteeUserId: sub,
				status: "accepted",
				invitedBy: "acc_someone",
			}),
		(sub) => CollaboratorModel.countDocuments({ inviteeUserId: sub }),
	],
	[
		"member_removals",
		(sub) =>
			MemberRemovalModel.create({
				projectId: new Types.ObjectId(),
				userSub: sub,
				removedBy: "acc_someone",
				removedAt: new Date(),
			}),
		(sub) => MemberRemovalModel.countDocuments({ userSub: sub }),
	],
	[
		"collection_links",
		(sub) =>
			CollectionLinkModel.create({
				collectionId: new Types.ObjectId(),
				kind: "public",
				linkId: `link-${sub}`,
				createdBy: sub,
			}),
		(sub) => CollectionLinkModel.countDocuments({ createdBy: sub }),
	],
	[
		"collection_access_keys",
		(sub) =>
			CollectionAccessKeyModel.create({
				collectionId: new Types.ObjectId(),
				userId: sub,
				name: "CI",
				keyHash: `hash-${sub}`,
				last4: "abcd",
			}),
		(sub) => CollectionAccessKeyModel.countDocuments({ userId: sub }),
	],
	[
		"run_buttons",
		(sub) =>
			RunButtonModel.create({
				buttonId: `button-${sub}`,
				collectionId: new Types.ObjectId(),
				visibility: "public",
				createdBy: sub,
			}),
		(sub) => RunButtonModel.countDocuments({ createdBy: sub }),
	],
	[
		"run_button_imports",
		(sub) =>
			RunButtonImportModel.create({
				userId: sub,
				idempotencyKey: `key-${sub}`,
				buttonId: "b",
				workspaceId: new Types.ObjectId(),
				expiresAt: new Date(Date.now() + 60_000),
			}),
		(sub) => RunButtonImportModel.countDocuments({ userId: sub }),
	],
	[
		"tunelo_links",
		(sub) => TunnelLinkModel.create({ userSub: sub, status: "pending" }),
		(sub) => TunnelLinkModel.countDocuments({ userSub: sub }),
	],
];
