import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { getWatch, setWatch } from "./watch-service.js";

const WATCH_PATH = `${COLLECTION_PATH}/watch`;
const watchView = z.object({
	collectionId: z.string(),
	watching: z.boolean(),
	available: z.boolean(),
});
const WHAT =
	"A watcher is told (in the app, by Web Push or Telegram, as they chose) when someone else changes a request, folder, example, variable, script or the collection itself: at most one notification per collection about every minute, summing up the changes. Their own changes are never reported. Only collections of a team workspace (`available`).";

export const getCollectionWatchOperation = defineOperation({
	id: "collab.getCollectionWatch",
	method: "GET",
	path: WATCH_PATH,
	summary: "Whether you watch a collection",
	description: `${WHAT} ${ACCESS_NOTE}`,
	input: z.object({ collectionId: collectionIdSchema }),
	output: watchView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "view");
		return getWatch(access, sub);
	},
});

export const setCollectionWatchOperation = defineOperation({
	id: "collab.setCollectionWatch",
	method: "PUT",
	path: WATCH_PATH,
	summary: "Watch or stop watching a collection",
	description: `${WHAT} Any role. 409 WATCH_UNAVAILABLE for a collection of a personal workspace. ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		watching: z.boolean(),
	}),
	output: watchView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "watch");
		return setWatch(access, sub, input.watching);
	},
});

export const watchOperations = [
	getCollectionWatchOperation,
	setCollectionWatchOperation,
];
