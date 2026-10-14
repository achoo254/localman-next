/**
 * A request with every credential typed in literally blanked: the
 * Authorization tab's token, password or API key value, the value of any
 * header, query param or form field (urlencoded, text form-data) whose
 * name says credential (`sensitive-names.ts`), such pairs in the URL's
 * fragment (`#access_token=…`), and the `user:password@` of the URL. A `{{var}}` reference stays: it
 * holds no secret. History records a send through it (an agent can read
 * history for 90 days), and every public view of a collection passes its
 * requests through it (`public-collection.ts`).
 *
 * A blanked credential is the marker: a draft opened again has an empty
 * value where a credential belongs, and the editor says so.
 */
import type {
	ApiRequestDraft,
	FormDataRow,
	KeyValueRow,
	RequestAuth,
	RequestBody,
} from "../request-model.js";
import { VARIABLE_PATTERN } from "../variable-interpolation.js";
import { paramsFromUrl, queryPairs, urlWithParams } from "./query-pairs.js";
import { isLiteralValue, isSensitiveName } from "./sensitive-names.js";

export function redactAuth(auth: RequestAuth): RequestAuth {
	switch (auth.type) {
		case "bearer":
			return isLiteralValue(auth.token) ? { ...auth, token: "" } : auth;
		case "basic":
			return isLiteralValue(auth.password) ? { ...auth, password: "" } : auth;
		case "apikey":
			return isLiteralValue(auth.value) ? { ...auth, value: "" } : auth;
		default:
			return auth;
	}
}

/** A header, param or field row with a literal credential value blanked. */
export function redactRow(row: KeyValueRow): KeyValueRow {
	return isSensitiveName(row.key) && isLiteralValue(row.value)
		? { ...row, value: "" }
		: row;
}

/** Ids stay the same, so the URL's params line up with the table's. */
const keepId = () => "";

/**
 * `user:password@` at the start of the authority, with or without a scheme
 * (`https://`, `{{scheme}}://`, `//`, none: the app adds `http://`).
 */
const USERINFO =
	/^((?:(?:[a-z][a-z0-9+.-]*|\{\{[^{}]+\}\}):)?\/\/)?([^/?#@]*)@/i;

function withoutUserinfo(url: string): string {
	const match = USERINFO.exec(url);
	if (!match) return url;
	const [whole, scheme = "", userinfo = ""] = match;
	const typed = userinfo.replace(VARIABLE_PATTERN, "").replace(/:/g, "");
	return typed === "" ? url : scheme + url.slice(whole.length);
}

/** `#a=1&access_token=x` with credential values blanked; pairs kept as typed. */
function redactFragment(hash: string): string {
	if (!hash.includes("=")) return hash;
	const parts = queryPairs(hash.slice(1)).map((pair) =>
		isSensitiveName(pair.key) && isLiteralValue(pair.value)
			? encodeURIComponent(pair.key)
			: pair.raw,
	);
	return `#${parts.join("&")}`;
}

/**
 * The URL with its userinfo and every credential value in its query and
 * fragment blanked; the same string when there is none.
 */
export function redactUrl(url: string): string {
	const hashAt = url.indexOf("#");
	const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
	const hash = hashAt === -1 ? "" : redactFragment(url.slice(hashAt));
	const bare = withoutUserinfo(beforeHash);
	const pairs = paramsFromUrl(bare, [], keepId);
	const redacted = pairs.map(redactRow);
	const query = redacted.some((row, index) => row !== pairs[index])
		? urlWithParams(bare, redacted)
		: bare;
	const result = query + hash;
	return result === url ? url : result;
}

function redactFormRow(row: FormDataRow): FormDataRow {
	return row.kind === "text" ? { ...row, ...redactRow(row) } : row;
}

/** Credential-named form fields blanked; raw and binary bodies are kept. */
function redactBody(body: RequestBody): RequestBody {
	const urlencoded = body.urlencoded.map(redactRow);
	const formData = body.formData.map(redactFormRow);
	const changed =
		urlencoded.some((row, index) => row !== body.urlencoded[index]) ||
		formData.some((row, index) => row.value !== body.formData[index]?.value);
	return changed ? { ...body, urlencoded, formData } : body;
}

/** `draft` with literal credentials blanked; the same object when none. */
export function redactDraft(draft: ApiRequestDraft): ApiRequestDraft {
	const auth = redactAuth(draft.auth);
	const headers = draft.headers.map(redactRow);
	const params = draft.params.map(redactRow);
	const url = redactUrl(draft.url);
	const body = redactBody(draft.body);
	const same =
		auth === draft.auth &&
		url === draft.url &&
		body === draft.body &&
		headers.every((row, index) => row === draft.headers[index]) &&
		params.every((row, index) => row === draft.params[index]);
	return same ? draft : { ...draft, auth, headers, params, url, body };
}

function blankCredential(row: KeyValueRow): boolean {
	return row.enabled && row.value === "" && isSensitiveName(row.key);
}

/** The draft has an empty value where a credential belongs. */
export function hasBlankedSecrets(draft: ApiRequestDraft): boolean {
	const { auth } = draft;
	if (auth.type === "bearer" && auth.token === "") return true;
	if (auth.type === "basic" && auth.username !== "" && auth.password === "") {
		return true;
	}
	if (auth.type === "apikey" && auth.key !== "" && auth.value === "") {
		return true;
	}
	return (
		draft.headers.some(blankCredential) || draft.params.some(blankCredential)
	);
}
