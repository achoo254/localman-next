/**
 * What the project page hands to `/api-client` through the router's
 * navigation state: ids only. The API client loads the mock URLs (which
 * carry the project secret) itself, so neither the address bar nor the
 * history entry ever holds the secret.
 */
import { isRecord } from "../../../lib/json-guards";

export const API_CLIENT_PATH = "/api-client";

export interface OpenInApiClient {
	projectId: string;
	/** One resource: its list request. Absent: every request of the project. */
	resourceId?: string;
}

const STATE_KEY = "openInApiClient";

/** Ids of projects and resources: Mongo ObjectIds, kept loose but bounded. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function openInApiClientState(target: OpenInApiClient): {
	[STATE_KEY]: OpenInApiClient;
} {
	return { [STATE_KEY]: target };
}

/** The target in `location.state`, or `null` when absent or malformed. */
export function readOpenInApiClient(state: unknown): OpenInApiClient | null {
	if (!isRecord(state)) return null;
	const target = state[STATE_KEY];
	if (!isRecord(target)) return null;
	const { projectId, resourceId } = target;
	if (typeof projectId !== "string" || !ID_PATTERN.test(projectId)) {
		return null;
	}
	if (resourceId === undefined) return { projectId };
	if (typeof resourceId !== "string" || !ID_PATTERN.test(resourceId)) {
		return null;
	}
	return { projectId, resourceId };
}
