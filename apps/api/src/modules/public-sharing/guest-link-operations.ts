/**
 * Guest links: a signed-in person who opens one sees the same redacted
 * collection as a public link and may ask for edit access through the
 * usual access requests. Opening it grants nothing: no role, no
 * membership. The id travels in a POST body, out of access logs.
 */
import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { elementRoleOf } from "../access/access-policy.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { collectionLinkOperations } from "./collection-link-operations.js";
import { servedCollection } from "./collection-link-service.js";
import { takeSignedInSlot } from "./public-sharing-limits.js";
import { linkIdSchema } from "./public-sharing-views.js";
import { publicCollectionView, publicViewOf } from "./public-tree.js";

export const guestLinkOperations = collectionLinkOperations({
	kind: "guest",
	name: "Guest",
	segment: "guest-link",
	what: "Signed-in people with the link read the collection, redacted as on a public link, and can ask for edit access; opening it grants no role.",
});

export const viewGuestCollectionOperation = defineOperation({
	id: "sharing.viewGuestCollection",
	method: "POST",
	path: "/guest-links/view",
	summary: "Read a collection through its guest link",
	description:
		"The redacted collection of a guest link, for the signed-in caller. `canRequestAccess` is false in a personal workspace (it cannot be shared) and once the caller has a role; `alreadyHasAccess` is true when they hold a role on the collection. 404 PUBLIC_LINK_NOT_FOUND for an unknown or turned-off link, a trashed collection, a creator who is no longer an Admin or Editor of the workspace, or guest links turned off there; 429 RATE_LIMITED.",
	input: z.object({ linkId: linkIdSchema }),
	output: publicCollectionView.extend({
		collectionId: z.string(),
		canRequestAccess: z.boolean(),
		alreadyHasAccess: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	// Reads only; POST keeps the link id out of URLs and logs.
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: {
		exempt:
			"Trang cho người đã mở guest link trên trình duyệt; agent đọc collection của mình qua client.getCollection",
	},
	handler: async (ctx, { linkId }) => {
		const sub = requireSubject(ctx);
		await takeSignedInSlot("guest", sub, ctx.clientIp);
		const collection = await servedCollection(linkId, "guest");
		const collectionId = collection._id.toHexString();
		const [view, workspace, role] = await Promise.all([
			publicViewOf(collection),
			findWorkspaceById(collection.workspaceId.toHexString()),
			elementRoleOf(
				sub,
				{
					type: "collection",
					id: collectionId,
					name: collection.name,
					workspaceId: collection.workspaceId,
				},
				{ claim: false },
			),
		]);
		const alreadyHasAccess = role !== null;
		return {
			...view,
			collectionId,
			alreadyHasAccess,
			canRequestAccess: workspace?.type === "team" && role !== "editor",
		};
	},
});
