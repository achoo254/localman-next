import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "./collection-access.js";
import { setFavorite } from "./collection-favorite-service.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "./collection-read-operations.js";

const SIDEBAR = "sidebar order of the API client page in the browser";
const FAVORITE_PATH = `${COLLECTION_PATH}/favorite`;
const favoriteView = z.object({
	collectionId: z.string(),
	favorite: z.boolean(),
});

function favoriteOperation(favorite: boolean) {
	return defineOperation({
		id: favorite ? "client.favoriteCollection" : "client.unfavoriteCollection",
		method: favorite ? "PUT" : "DELETE",
		path: FAVORITE_PATH,
		summary: favorite
			? "Star a collection so it comes first in the caller's sidebar"
			: "Unstar a collection",
		description: `For the caller alone; any role on the collection. ${ACCESS_NOTE}`,
		input: z.object({ collectionId: collectionIdSchema }),
		output: favoriteView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "client",
		mcp: { exempt: SIDEBAR },
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const access = await requireCollection(sub, input.collectionId, "view");
			await setFavorite(sub, access.collectionId, favorite);
			return { collectionId: access.element.id, favorite };
		},
	});
}

export const favoriteCollectionOperation = favoriteOperation(true);
export const unfavoriteCollectionOperation = favoriteOperation(false);
