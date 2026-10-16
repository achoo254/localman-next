/** Whether the caller watches a collection, parsed. */
import type { CollectionWatchView } from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	expectBoolean,
	expectRecord,
	expectString,
} from "../../lib/json-guards";
import { collectionPath } from "../collections/collections-api";

function watchOf(value: unknown): CollectionWatchView {
	const data = expectRecord(value, "watch");
	return {
		collectionId: expectString(data, "collectionId"),
		watching: expectBoolean(data, "watching"),
		available: expectBoolean(data, "available"),
	};
}

export async function fetchWatch(
	collectionId: string,
): Promise<CollectionWatchView> {
	return watchOf(await apiRequest(`${collectionPath(collectionId)}/watch`));
}

export async function setWatch(
	collectionId: string,
	watching: boolean,
): Promise<CollectionWatchView> {
	return watchOf(
		await apiRequest(`${collectionPath(collectionId)}/watch`, {
			method: "PUT",
			body: { watching },
		}),
	);
}
