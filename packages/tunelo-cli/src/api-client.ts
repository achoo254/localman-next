/**
 * Minimal HTTP client for the Tunelo server API.
 * Surfaces after the account/admin removal: device pairing + token verify.
 */

interface ApiErrorResponse {
	error?: { code: string; message: string };
}

export class ApiClientError extends Error {
	constructor(
		public code: string,
		message: string,
		public statusCode: number,
	) {
		super(message);
		this.name = "ApiClientError";
	}
}

/** Derives HTTP API base URL from WS server URL */
export function getApiBaseUrl(serverUrl: string): string {
	return serverUrl
		.replace(/^wss:\/\//, "https://")
		.replace(/^ws:\/\//, "http://")
		.replace(/\/$/, "");
}

async function request<T>(
	baseUrl: string,
	path: string,
	options: { method?: string; apiKey?: string; body?: unknown } = {},
): Promise<T> {
	const headers: Record<string, string> = {};
	if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
	if (options.body !== undefined) headers["Content-Type"] = "application/json";

	const res = await fetch(`${baseUrl}/api${path}`, {
		method: options.method ?? "GET",
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});

	const text = await res.text();
	let data: T & ApiErrorResponse;
	try {
		data = JSON.parse(text) as T & ApiErrorResponse;
	} catch {
		throw new ApiClientError(
			"TUNELO_UNKNOWN",
			text || `HTTP ${res.status}`,
			res.status,
		);
	}

	if (!res.ok) {
		throw new ApiClientError(
			data.error?.code ?? "TUNELO_UNKNOWN",
			data.error?.message ?? `HTTP ${res.status}`,
			res.status,
		);
	}

	return data;
}

/** Starts a device login; returns the request id the browser will approve. */
export async function initDeviceLogin(
	baseUrl: string,
	deviceId: string,
	name: string,
): Promise<string> {
	const data = await request<{ requestId: string }>(baseUrl, "/device/init", {
		method: "POST",
		body: { deviceId, name },
	});
	return data.requestId;
}

export type DeviceLoginPoll =
	| { status: "pending" }
	| { status: "approved"; token: string }
	| { status: "expired" };

/** Polls a device-login request; returns the token once approved. */
export async function pollDeviceLogin(
	baseUrl: string,
	requestId: string,
): Promise<DeviceLoginPoll> {
	return request<DeviceLoginPoll>(baseUrl, "/device/poll", {
		method: "POST",
		body: { req: requestId },
	});
}

/** Checks an access token with the server. true = valid, false = rejected (401). */
export async function verifyKey(
	baseUrl: string,
	key: string,
): Promise<boolean> {
	try {
		await request<{ valid: boolean }>(baseUrl, "/verify", { apiKey: key });
		return true;
	} catch (err) {
		if (err instanceof ApiClientError && err.statusCode === 401) return false;
		throw err;
	}
}
