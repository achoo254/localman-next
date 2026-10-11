/**
 * The trash: moving a collection there, and the deleted collections the
 * caller may restore or delete for good.
 */
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
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

/** Narrows the trash: original workspace, who deleted it, part of the name. */
export interface TrashFilters {
	workspaceId: string;
	deletedBy: string;
	q: string;
}

export interface TrashListing {
	items: TrashedCollection[];
	/** Everyone who deleted something there, for the "Deleted by" filter. */
	deleters: { id: string; name: string | null }[];
}

/** Newest first; empty filters are left out. */
export async function fetchTrash(filters: TrashFilters): Promise<TrashListing> {
	const query = new URLSearchParams();
	if (filters.workspaceId) query.set("workspaceId", filters.workspaceId);
	if (filters.deletedBy) query.set("deletedBy", filters.deletedBy);
	if (filters.q.trim()) query.set("q", filters.q.trim().slice(0, 100));
	const search = query.toString();
	const data = expectRecord(
		await apiRequest(`/api/v1/trash/collections${search ? `?${search}` : ""}`),
		"trash list",
	);
	const deleters = Array.isArray(data.deleters) ? data.deleters : [];
	return {
		items: expectArray(data, "items").map(parseTrashed),
		deleters: deleters.map((value) => {
			const person = expectRecord(value, "deleter");
			return {
				id: expectString(person, "id"),
				name: optionalString(person, "name"),
			};
		}),
	};
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
