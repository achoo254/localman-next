/**
 * Request model of the API client: what a tab edits, what a draft and a
 * history entry store, and what import/export read and write. Plain types
 * only, so the web bundle does not pull zod (the schema lives in
 * `request-schema.ts`).
 */
import { DEFAULT_TIMEOUT_MS } from "./limits.js";

export const HTTP_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** One header on the wire. Kept as a list: order matters and names repeat. */
export interface HeaderEntry {
	name: string;
	value: string;
}

/** A row of the params, headers or url-encoded table. */
export interface KeyValueRow {
	id: string;
	key: string;
	value: string;
	enabled: boolean;
	description?: string;
}

/**
 * A file picked in the browser. Drafts and history keep only the name; the
 * bytes stay in the tab and reach the preparer through `fileId`.
 */
export interface FileRef {
	fileId: string;
	name: string;
	contentType: string;
	size: number;
}

/** A form-data row: text (`value`) or a file (`file`, `value` unused). */
export interface FormDataRow extends KeyValueRow {
	kind: "text" | "file";
	file?: FileRef;
}

export const BODY_TYPES = [
	"none",
	"formdata",
	"urlencoded",
	"raw",
	"binary",
] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const RAW_LANGUAGES = [
	"json",
	"text",
	"xml",
	"html",
	"javascript",
] as const;
export type RawLanguage = (typeof RAW_LANGUAGES)[number];

/**
 * Body of a request. Every kind keeps its content when the user switches
 * `type`, so going from raw to form-data and back loses nothing; only the
 * active `type` is sent.
 */
export interface RequestBody {
	type: BodyType;
	rawLanguage: RawLanguage;
	raw: string;
	urlencoded: KeyValueRow[];
	formData: FormDataRow[];
	binary: FileRef | null;
}

export const AUTH_TYPES = [
	"inherit",
	"none",
	"bearer",
	"basic",
	"apikey",
] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const API_KEY_LOCATIONS = ["header", "query"] as const;
export type ApiKeyLocation = (typeof API_KEY_LOCATIONS)[number];

export type RequestAuth =
	| { type: "inherit" }
	| { type: "none" }
	| { type: "bearer"; token: string }
	| { type: "basic"; username: string; password: string }
	| { type: "apikey"; key: string; value: string; in: ApiKeyLocation };

/** Auth that is actually applied: `inherit` resolved against the parents. */
export type EffectiveAuth = Exclude<RequestAuth, { type: "inherit" }>;

export const ROUTE_MODES = ["auto", "direct", "proxy"] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

export interface RequestSettings {
	followRedirects: boolean;
	timeoutMs: number;
	/** Add `X-Forwarded-For`, `X-Real-IP` and `Forwarded` (proxy only). */
	sendClientIp: boolean;
	route: RouteMode;
}

export interface RequestScripts {
	pre: string;
	post: string;
}

export interface ApiRequestDraft {
	name: string;
	method: HttpMethod;
	/** Full URL as typed, query included; `params` mirrors its query. */
	url: string;
	params: KeyValueRow[];
	headers: KeyValueRow[];
	auth: RequestAuth;
	body: RequestBody;
	scripts: RequestScripts;
	settings: RequestSettings;
}

export const DEFAULT_REQUEST_SETTINGS: Readonly<RequestSettings> =
	Object.freeze({
		followRedirects: true,
		timeoutMs: DEFAULT_TIMEOUT_MS,
		sendClientIp: true,
		route: "auto",
	});

export function emptyRequestBody(): RequestBody {
	return {
		type: "none",
		rawLanguage: "json",
		raw: "",
		urlencoded: [],
		formData: [],
		binary: null,
	};
}

/** A new tab's request; `overrides` replace whole top-level fields. */
export function createRequestDraft(
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft {
	return {
		name: "",
		method: "GET",
		url: "",
		params: [],
		headers: [],
		auth: { type: "none" },
		body: emptyRequestBody(),
		scripts: { pre: "", post: "" },
		settings: { ...DEFAULT_REQUEST_SETTINGS },
		...overrides,
	};
}
