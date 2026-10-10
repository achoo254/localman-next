import { activeTranslator } from "../i18n/active-translator";
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
		/** `error.details` of the response body, unvalidated. */
		readonly details?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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

/** Generic server failure, in the language on screen. */
function fallbackMessage(): string {
	return activeTranslator().t("common.errors.server");
}

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
			typeof error.message === "string" ? error.message : fallbackMessage();
		return new ApiError(status, error.code, message, error.details);
	}
	return new ApiError(status, `HTTP_${status}`, fallbackMessage());
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
		throw new ApiError(
			0,
			"NETWORK_ERROR",
			activeTranslator().t("common.errors.network"),
		);
	}

	const payload = await readJson(response);
	if (response.ok) {
		if (payload === undefined) {
			throw new ApiError(response.status, "INVALID_JSON", fallbackMessage());
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

/** Destructive routes answer a preview instead of writing with `?dryRun=true`. */
export const withDryRun = (path: string, dryRun: boolean): string =>
	dryRun ? `${path}?dryRun=true` : path;

/**
 * Message safe to show the user for any thrown value, in the language on
 * screen. A rate limit (429 `RATE_LIMITED`, e.g. on generate, data replace
 * or clone) gets its own sentence; flows with a more specific one map it
 * before calling this. Other API messages are shown as the API wrote them.
 */
export function errorMessage(error: unknown): string {
	if (!(error instanceof ApiError)) return fallbackMessage();
	return error.code === "RATE_LIMITED"
		? activeTranslator().t("common.errors.rateLimited")
		: error.message;
}
