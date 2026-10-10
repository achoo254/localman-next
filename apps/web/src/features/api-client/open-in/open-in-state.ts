/**
 * What the project page hands to `/api-client` through the router's
 * navigation state: ids only (a mock project, one of its resources, or a
 * request log line). The API client loads the URLs or the draft itself,
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
}

export const OPEN_IN_STATE_KEY = "openInApiClient";

/** Ids of projects, resources and log lines: Mongo ObjectIds, kept loose but bounded. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const isId = (value: unknown): value is string =>
	typeof value === "string" && ID_PATTERN.test(value);

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
	const { projectId, resourceId, logId } = target;
	if (!isId(projectId)) return null;
	if (resourceId !== undefined && logId !== undefined) return null;
	if (resourceId !== undefined) {
		return isId(resourceId) ? { projectId, resourceId } : null;
	}
	if (logId !== undefined) return isId(logId) ? { projectId, logId } : null;
	return { projectId };
}
