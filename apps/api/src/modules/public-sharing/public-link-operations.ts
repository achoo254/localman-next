import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { collectionLinkOperations } from "./collection-link-operations.js";
import { servedCollection } from "./collection-link-service.js";
import { takeIpSlot } from "./public-sharing-limits.js";
import { linkIdSchema } from "./public-sharing-views.js";
import { publicCollectionView, publicViewOf } from "./public-tree.js";

export const publicLinkOperations = collectionLinkOperations({
	kind: "public",
	name: "Public",
	segment: "public-link",
	what: "Anyone with the link reads the collection (folders, requests, examples without their response bodies, descriptions, variables) without signing in.",
});

export const getPublicCollectionOperation = defineOperation({
	id: "public.getPublicCollection",
	method: "GET",
	path: "/public/links/:linkId",
	summary: "Read a collection through its public link",
	description:
		"Public, no sign-in. The redacted collection of a public link. 404 PUBLIC_LINK_NOT_FOUND for an unknown or turned-off link, a trashed collection, a creator who is no longer an Admin or Editor of the workspace, or public links turned off there; 429 RATE_LIMITED per client address.",
	input: z.object({ linkId: linkIdSchema }),
	output: publicCollectionView,
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "public",
	mcp: {
		exempt:
			"Trang công khai cho người mở link trên trình duyệt; agent đọc collection của mình qua client.getCollection",
	},
	handler: async (ctx, { linkId }) => {
		// Counted before any lookup, so guessing ids costs the guesser.
		await takeIpSlot("publicLink", ctx.clientIp);
		return publicViewOf(await servedCollection(linkId, "public"));
	},
});
