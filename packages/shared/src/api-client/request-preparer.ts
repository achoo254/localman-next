/**
 * Turns a draft into what goes on the wire: final URL (params and API key
 * in query), ordered headers (repeats kept, auth added), body, and which
 * secret variables it carries. Pure: the same result feeds a direct
 * `fetch` and the proxy envelope.
 */
import { authParts, resolveEffectiveAuth } from "./auth-headers.js";
import { isValidHeaderName, isValidHeaderValue } from "./header-rules.js";
import { createMultipartBoundary } from "./multipart-encoder.js";
import { type PreparedBody, buildPreparedBody } from "./prepare-body.js";
import { RequestPrepareError } from "./prepare-error.js";
import type {
	ApiRequestDraft,
	EffectiveAuth,
	HeaderEntry,
	HttpMethod,
} from "./request-model.js";
import {
	appendQueryParams,
	buildUrlWithParams,
	normalizeRequestUrl,
	parseHttpUrl,
} from "./url-params.js";
import {
	type InterpolationContext,
	createInterpolator,
} from "./variable-interpolation.js";

export interface PrepareOptions {
	/** Scopes, plus `runFaker` when the caller loaded Faker for `$random…`. */
	variables?: InterpolationContext;
	/** Parent auth used when the draft's auth is `inherit`. */
	inheritedAuth?: EffectiveAuth;
	/** Bytes of picked files by `FileRef.fileId`. */
	files?: ReadonlyMap<string, Uint8Array>;
	/** Fixed multipart boundary (tests); random by default. */
	boundary?: string;
}

export interface PreparedRequest {
	method: HttpMethod;
	url: string;
	headers: HeaderEntry[];
	body: PreparedBody;
	/** Secret variables whose values are in the URL, headers or body. */
	secretsUsed: string[];
	/**
	 * Their values, to hide them where the request is shown or logged;
	 * absent where nothing was filled in by this preparer.
	 */
	secretValues?: string[];
	/** `{{names}}` left as typed. */
	unresolved: string[];
}

const NO_FILES: ReadonlyMap<string, Uint8Array> = new Map();

function sameName(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

function checkHeader(header: HeaderEntry): HeaderEntry {
	if (!isValidHeaderName(header.name)) {
		throw new RequestPrepareError("INVALID_HEADER_NAME", header.name);
	}
	if (!isValidHeaderValue(header.value)) {
		throw new RequestPrepareError("INVALID_HEADER_VALUE", header.name);
	}
	return header;
}

/**
 * Throws `RequestPrepareError` for a URL that is not http(s) after
 * interpolation, an invalid header, a missing file or a body over 10 MB.
 */
export function prepareRequest(
	draft: ApiRequestDraft,
	options: PrepareOptions = {},
): PreparedRequest {
	const interpolator = createInterpolator(options.variables);
	const fill = interpolator.apply;
	const auth = authParts(
		resolveEffectiveAuth(draft.auth, options.inheritedAuth),
		fill,
	);

	const params = draft.params.map((param) =>
		param.enabled
			? { ...param, key: fill(param.key), value: fill(param.value) }
			: param,
	);
	const url = appendQueryParams(
		buildUrlWithParams(normalizeRequestUrl(fill(draft.url)), params),
		auth.query,
	);
	// The URL parser accepts braces in a host, so an unresolved
	// `{{baseUrl}}` would otherwise become a DNS lookup of "{{baseurl}}".
	const parsed = parseHttpUrl(url);
	if (!parsed || /[{}]/.test(parsed.hostname)) {
		throw new RequestPrepareError("INVALID_URL");
	}

	const userHeaders = draft.headers
		.filter((row) => row.enabled && row.key.trim())
		.map((row) => ({
			name: fill(row.key.trim()).trim(),
			value: fill(row.value),
		}));
	// Auth wins over a header of the same name typed in the Headers tab.
	const headers = userHeaders
		.filter((h) => !auth.headers.some((a) => sameName(a.name, h.name)))
		.concat(auth.headers)
		.map(checkHeader);

	const { body, contentType } = buildPreparedBody(draft.method, draft.body, {
		fill,
		files: options.files ?? NO_FILES,
		boundary: options.boundary ?? createMultipartBoundary(),
	});
	if (contentType && !headers.some((h) => sameName(h.name, "content-type"))) {
		headers.push({ name: "Content-Type", value: contentType });
	}

	return {
		method: draft.method,
		url,
		headers,
		body,
		secretsUsed: interpolator.secretsUsed(),
		secretValues: interpolator.secretValues(),
		unresolved: interpolator.unresolved(),
	};
}
