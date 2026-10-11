/**
 * The trash: moving a collection there, and the deleted collections the
 * caller may restore or delete for good.
 */
import { apiRequest, withDryRun } from "../../lib/api-client";
import { expectArray, expectNumber, expectRecord } from "../../lib/json-guards";
import { type TrashedCollection, parseTrashed } from "./collection-parsers";
import { collectionPath } from "./collections-api";

/** What moving it to the trash takes along, as the server counts it now. */
export async function previewTrash(
	id: string,
): Promise<{ folders: number; requests: number }> {
	const data = expectRecord(
		await apiRequest(withDryRun(collectionPath(id), true), {
			method: "DELETE",
			body: {},
		}),
		"trash preview",
	);
	return {
		folders: expectNumber(data, "folders"),
		requests: expectNumber(data, "requests"),
	};
}

/** To the trash; `confirm` is `DELETE_CONFIRMATION` when it holds requests. */
export async function trashCollection(
	id: string,
	confirm?: string,
): Promise<void> {
	await apiRequest(collectionPath(id), {
		method: "DELETE",
		body: confirm === undefined ? {} : { confirm },
	});
}

const trashPath = (id: string): string =>
	`/api/v1/trash/collections/${encodeURIComponent(id)}`;

/** Newest first. */
export async function fetchTrash(): Promise<TrashedCollection[]> {
	const data = expectRecord(
		await apiRequest("/api/v1/trash/collections"),
		"trash list",
	);
	return expectArray(data, "items").map(parseTrashed);
}

export async function restoreTrashed(
	id: string,
	workspaceId: string,
): Promise<void> {
	await apiRequest(`${trashPath(id)}/restore`, {
		method: "POST",
		body: { workspaceId },
	});
}

export async function deleteTrashed(id: string): Promise<void> {
	await apiRequest(trashPath(id), { method: "DELETE" });
}
