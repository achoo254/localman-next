/**
 * `curl …` (bash, cmd or PowerShell) to a request draft. Commands copied
 * from browser dev tools and the client's own cURL snippet import back to
 * the same request: auth headers become the Auth tab, a Content-Type the
 * body implies anyway is not kept as a header row.
 */
import { base64ToBytes, decodeUtf8OrNull, isBase64 } from "../byte-encoding.js";
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "../limits.js";
import {
	type ApiRequestDraft,
	HTTP_METHODS,
	type HttpMethod,
	type RequestAuth,
	type RequestBody,
	createRequestDraft,
	emptyRequestBody,
} from "../request-model.js";
import { parseQueryFromUrl } from "../url-params.js";
import { bodyFromData, formDataRows, removeHeader } from "./curl-body.js";
import type { CurlParts } from "./curl-option-table.js";
import { readCurlOptions } from "./curl-options.js";
import { tokenizeCommand } from "./curl-tokenizer.js";
import {
	type ImportContext,
	type RequestImportOptions,
	clampDraft,
	createImportContext,
} from "./import-context.js";
import {
	RequestImportFailure,
	type RequestImportResult,
	type RequestImportWarning,
	paramText,
	runImport,
} from "./import-error.js";
import { checkImportText } from "./import-json.js";

export interface CurlImport {
	draft: ApiRequestDraft;
	warnings: RequestImportWarning[];
}

/** `curl` or `curl.exe`, any case, as the first word. */
export function looksLikeCurl(text: string): boolean {
	return /^curl(\.exe)?(\s|$)/i.test(text.trim());
}

function pickMethod(parts: CurlParts, ctx: ImportContext): HttpMethod {
	const explicit = parts.method?.toUpperCase() ?? null;
	const known = HTTP_METHODS.find((method) => method === explicit);
	if (known) return known;
	if (explicit !== null) {
		ctx.warn("UNSUPPORTED_METHOD", "", { method: paramText(explicit) });
	}
	if (parts.head) return "HEAD";
	if (parts.get) return "GET";
	return parts.data.length > 0 || parts.form.length > 0 ? "POST" : "GET";
}

/** Single `Authorization: Bearer …` or `Basic …` header to the Auth tab. */
function authFromHeaders(parts: CurlParts): RequestAuth {
	if (parts.user !== null) {
		const colon = parts.user.indexOf(":");
		return colon === -1
			? { type: "basic", username: parts.user, password: "" }
			: {
					type: "basic",
					username: parts.user.slice(0, colon),
					password: parts.user.slice(colon + 1),
				};
	}
	if (parts.bearer !== null) return { type: "bearer", token: parts.bearer };
	const found = parts.headers.filter(
		(h) => h.name.toLowerCase() === "authorization",
	);
	if (found.length !== 1) return { type: "none" };
	const [scheme = "", credentials = ""] = found[0].value.split(/ +/, 2);
	if (/^bearer$/i.test(scheme) && credentials) {
		removeHeader(parts.headers, "authorization");
		return { type: "bearer", token: credentials };
	}
	const decoded =
		/^basic$/i.test(scheme) && isBase64(credentials)
			? decodeUtf8OrNull(base64ToBytes(credentials))
			: null;
	const colon = decoded?.indexOf(":") ?? -1;
	if (decoded === null || colon === -1) return { type: "none" };
	removeHeader(parts.headers, "authorization");
	return {
		type: "basic",
		username: decoded.slice(0, colon),
		password: decoded.slice(colon + 1),
	};
}

function withQuery(url: string, pieces: readonly string[]): string {
	if (pieces.length === 0) return url;
	const [beforeHash, hash] = url.split(/#(.*)/s, 2);
	const joiner = beforeHash.includes("?") ? "&" : "?";
	const query = `${beforeHash}${joiner}${pieces.join("&")}`;
	return hash === undefined ? query : `${query}#${hash}`;
}

function buildBody(parts: CurlParts, ctx: ImportContext): RequestBody {
	if (parts.form.length > 0) {
		removeHeader(parts.headers, "content-type", (value) =>
			/^\s*multipart\/form-data/i.test(value),
		);
		return {
			...emptyRequestBody(),
			type: "formdata",
			formData: formDataRows(parts.form, ctx),
		};
	}
	if (parts.data.length === 0) return emptyRequestBody();
	if (parts.json) {
		for (const name of ["Content-Type", "Accept"]) {
			const has = parts.headers.some(
				(h) => h.name.toLowerCase() === name.toLowerCase(),
			);
			if (!has) parts.headers.push({ name, value: "application/json" });
		}
	}
	return bodyFromData(parts.data.join("&"), parts.headers, ctx);
}

function buildDraft(parts: CurlParts, ctx: ImportContext): ApiRequestDraft {
	const [first, ...more] = parts.urls;
	if (first === undefined || !first.trim()) {
		throw new RequestImportFailure("INVALID_CURL");
	}
	if (more.length > 0) ctx.warn("EXTRA_URLS", "", { count: more.length });
	const method = pickMethod(parts, ctx);
	const url = withQuery(first.trim(), parts.get ? parts.data : []);
	if (parts.get) parts.data = [];
	const auth = authFromHeaders(parts);
	const body = buildBody(parts, ctx);
	const seconds = parts.timeoutSeconds;
	const draft = createRequestDraft({
		name: url.split(/[?#]/, 1)[0],
		method,
		url,
		params: parseQueryFromUrl(url, ctx.newId),
		headers: parts.headers.map(({ name, value }) => ({
			id: ctx.newId(),
			key: name,
			value,
			enabled: true,
		})),
		auth,
		body,
	});
	if (seconds !== null && Number.isFinite(seconds) && seconds > 0) {
		const ms = Math.round(seconds * 1000);
		draft.settings.timeoutMs = Math.min(
			MAX_TIMEOUT_MS,
			Math.max(MIN_TIMEOUT_MS, ms),
		);
	}
	return clampDraft(draft, ctx, "");
}

/** Internal entry used by `importText`; throws `RequestImportFailure`. */
export function curlToDraft(text: string, ctx: ImportContext): ApiRequestDraft {
	const [command, ...words] = tokenizeCommand(text.trim());
	if (command === undefined || !/^curl(\.exe)?$/i.test(command.text)) {
		throw new RequestImportFailure("INVALID_CURL");
	}
	return buildDraft(readCurlOptions(words, ctx), ctx);
}

/**
 * Parses one `curl` command (pasted in the URL bar or the import dialog).
 * Errors: `INPUT_TOO_LARGE`, `EMPTY_INPUT`, `INVALID_CURL`,
 * `UNTERMINATED_QUOTE`.
 */
export function parseCurlCommand(
	text: string,
	options: RequestImportOptions = {},
): RequestImportResult<CurlImport> {
	return runImport(() => {
		const ctx = createImportContext(options);
		const draft = curlToDraft(checkImportText(text), ctx);
		return { draft, warnings: ctx.warnings() };
	});
}
