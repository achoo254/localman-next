import { currentPath, navigateToLogin } from "../platform/navigation";
import { apiUrl } from "./api-url";
import { isRecord } from "./json-guards";
import { allowAutoLoginRedirect } from "./login-redirect-guard";

/** Error from the API (`{ error: { code, message } }`) or the network. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestOptions {
	method?: HttpMethod;
	/** Serialised as JSON. */
	body?: unknown;
	/**
	 * On 401, leave for `/auth/login?returnTo=<current page>` (default) unless
	 * the redirect-loop guard refuses. Turn off where "not signed in" is an
	 * expected answer, e.g. the session probe or best-effort logout cleanup.
	 */
	redirectOnUnauthorized?: boolean;
	signal?: AbortSignal;
}

const FALLBACK_MESSAGE = "Máy chủ gặp lỗi, thử lại sau.";

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text === "") return null;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function toApiError(status: number, payload: unknown): ApiError {
	const error = isRecord(payload) ? payload.error : undefined;
	if (isRecord(error) && typeof error.code === "string") {
		const message =
			typeof error.message === "string" ? error.message : FALLBACK_MESSAGE;
		return new ApiError(status, error.code, message);
	}
	return new ApiError(status, `HTTP_${status}`, FALLBACK_MESSAGE);
}

/**
 * Same-origin JSON request to the Localman API. Resolves with the parsed
 * body (`null` when empty); rejects with ApiError on network or HTTP errors.
 */
export async function apiRequest(
	path: string,
	{
		method = "GET",
		body,
		redirectOnUnauthorized = true,
		signal,
	}: ApiRequestOptions = {},
): Promise<unknown> {
	const headers: Record<string, string> = { Accept: "application/json" };
	if (body !== undefined) headers["Content-Type"] = "application/json";

	let response: Response;
	try {
		response = await fetch(apiUrl(path), {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: "same-origin",
			signal,
		});
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === "AbortError") {
			throw cause;
		}
		throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ.");
	}

	const payload = await readJson(response);
	if (response.ok) {
		if (payload === undefined) {
			throw new ApiError(response.status, "INVALID_JSON", FALLBACK_MESSAGE);
		}
		return payload;
	}
	if (
		response.status === 401 &&
		redirectOnUnauthorized &&
		allowAutoLoginRedirect()
	) {
		navigateToLogin({ returnTo: currentPath() });
	}
	throw toApiError(response.status, payload);
}

/** Message safe to show the user for any thrown value. */
export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) return error.message;
	return FALLBACK_MESSAGE;
}
