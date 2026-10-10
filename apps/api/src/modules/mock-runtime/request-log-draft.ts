import { randomUUID } from "node:crypto";
import {
	type ApiRequestDraft,
	HTTP_METHODS,
	type HttpMethod,
	type KeyValueRow,
	MAX_HEADERS,
	MAX_REQUEST_NAME_LENGTH,
	MAX_TABLE_ROWS,
	type RawLanguage,
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";
import { REDACTED } from "./request-log-entry.js";
import type { StoredRequestLog } from "./request-log-model.js";

/** Headers the API client sets itself; a draft leaves them out. */
const SET_BY_CLIENT = new Set(["host", "content-length", "connection"]);

function row(key: string, value: string, enabled = true): KeyValueRow {
	return { id: randomUUID(), key, value, enabled };
}

function methodOf(method: string): HttpMethod {
	return HTTP_METHODS.find((m) => m === method) ?? "GET";
}

function headerValue(line: StoredRequestLog, name: string): string {
	const found = line.request.headers.find((h) => h.name.toLowerCase() === name);
	return found?.value.toLowerCase() ?? "";
}

function rawLanguageOf(contentType: string): RawLanguage {
	if (contentType.includes("json")) return "json";
	if (contentType.includes("xml")) return "xml";
	if (contentType.includes("html")) return "html";
	if (contentType.includes("javascript")) return "javascript";
	return "text";
}

/** Body tab of the draft: form rows, raw text, or nothing for bytes. */
function bodyOf(line: StoredRequestLog): ApiRequestDraft["body"] {
	const body = emptyRequestBody();
	const { request } = line;
	if (request.size === 0 || request.bodyEncoding === "base64") return body;
	const contentType = headerValue(line, "content-type");
	if (contentType.startsWith("application/x-www-form-urlencoded")) {
		const pairs = [...new URLSearchParams(request.body)].slice(
			0,
			MAX_TABLE_ROWS,
		);
		return {
			...body,
			type: "urlencoded",
			urlencoded: pairs.map(([key, value]) => row(key, value)),
		};
	}
	return {
		...body,
		type: "raw",
		rawLanguage: rawLanguageOf(contentType),
		raw: request.body,
	};
}

/**
 * A new API client tab for a log line ("Open in API client"): the mock
 * URL with the logged path and query (params mirror the query), the
 * client's headers (masked ones kept as empty, disabled rows to fill in),
 * and the body as raw text or url-encoded rows. Binary bodies and bodies
 * cut in the log are left out, since the tab could not send them as is.
 */
export function draftOfLogLine(
	line: StoredRequestLog,
	mockOrigin: string,
): ApiRequestDraft {
	const query = line.query ? `?${line.query}` : "";
	const params = [...new URLSearchParams(line.query)]
		.slice(0, MAX_TABLE_ROWS)
		.map(([key, value]) => row(key, value));
	const headers = line.request.headers
		.filter((h) => !SET_BY_CLIENT.has(h.name.toLowerCase()))
		.slice(0, MAX_HEADERS)
		.map((h) =>
			h.value === REDACTED ? row(h.name, "", false) : row(h.name, h.value),
		);
	return createRequestDraft({
		name: `${line.method} ${line.path}`.slice(0, MAX_REQUEST_NAME_LENGTH),
		method: methodOf(line.method),
		url: `${mockOrigin}${line.path}${query}`,
		params,
		headers,
		body: line.request.truncated ? emptyRequestBody() : bodyOf(line),
	});
}
