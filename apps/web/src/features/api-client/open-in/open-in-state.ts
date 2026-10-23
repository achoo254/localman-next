/**
 * What the project page hands to `/api-client` through the router's
 * navigation state: ids only (a mock project, one of its resources, a
 * request log line, or the page of a collection synced with it). The API client loads the URLs or the draft itself,
 * since they carry the project secret, which must stay out of history
 * state and the address bar; it replaces the entry's state with `null` as
 * soon as it reads it.
 */
import { isRecord } from "../../../lib/json-guards";

export const API_CLIENT_PATH = "/api-client";

export interface OpenInApiClient {
	projectId: string;
	/** One resource: its list request. */
	resourceId?: string;
	/** One request log line, opened as a draft. */
	logId?: string;
	/** A collection synced with the project: its page. */
	collection?: { id: string; name: string };
}

export const OPEN_IN_STATE_KEY = "openInApiClient";

/** Ids of projects, resources and log lines: Mongo ObjectIds, kept loose but bounded. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const isId = (value: unknown): value is string =>
	typeof value === "string" && ID_PATTERN.test(value);

/** Collection names are 1–200 characters. */
const isName = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0 && value.length <= 200;

export function openInApiClientState(target: OpenInApiClient): {
	[OPEN_IN_STATE_KEY]: OpenInApiClient;
} {
	return { [OPEN_IN_STATE_KEY]: target };
}

/**
 * The target in `location.state`, or `null` when absent or malformed.
 * Without `resourceId` or `logId`: every request of the project.
 */
export function readOpenInApiClient(state: unknown): OpenInApiClient | null {
	if (!isRecord(state)) return null;
	const target = state[OPEN_IN_STATE_KEY];
	if (!isRecord(target)) return null;
	const { projectId, resourceId, logId, collection } = target;
	if (!isId(projectId)) return null;
	if (collection !== undefined) {
		if (resourceId !== undefined || logId !== undefined) return null;
		if (!isRecord(collection)) return null;
		const { id, name } = collection;
		return isId(id) && isName(name)
			? { projectId, collection: { id, name } }
			: null;
	}
	if (resourceId !== undefined && logId !== undefined) return null;
	if (resourceId !== undefined) {
		return isId(resourceId) ? { projectId, resourceId } : null;
	}
	if (logId !== undefined) return isId(logId) ? { projectId, logId } : null;
	return { projectId };
}
