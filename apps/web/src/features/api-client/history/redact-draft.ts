/**
 * History keeps a request for 90 days and an agent can read it, so a
 * credential typed in literally is blanked before a send is recorded: the
 * Authorization tab's token, password or API key value, and the value of
 * any header or query param whose name says credential (same detector as
 * the proxy consent, `routing/sensitive-parts.ts`). A `{{var}}` reference
 * stays: it holds no secret. The draft of the open tab is not touched.
 *
 * A blanked credential is the marker: a history entry opened again has
 * an empty value where a credential belongs, and the editor says so.
 */
import type {
	ApiRequestDraft,
	KeyValueRow,
	RequestAuth,
} from "@localman/shared/api-client";
import { paramsFromUrl, urlWithParams } from "../request/params-sync";
import { isLiteralValue, isSensitiveName } from "../routing/sensitive-parts";

function redactAuth(auth: RequestAuth): RequestAuth {
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

function redactRow(row: KeyValueRow): KeyValueRow {
	return isSensitiveName(row.key) && isLiteralValue(row.value)
		? { ...row, value: "" }
		: row;
}

/** Ids stay the same, so the URL's params line up with the table's. */
const keepId = () => "";

/** The URL with every credential value in its query blanked. */
function redactUrl(url: string): string {
	const pairs = paramsFromUrl(url, [], keepId);
	const redacted = pairs.map(redactRow);
	return redacted.some((row, index) => row !== pairs[index])
		? urlWithParams(url, redacted)
		: url;
}

/** `draft` with literal credentials blanked; the same object when none. */
export function redactDraft(draft: ApiRequestDraft): ApiRequestDraft {
	const auth = redactAuth(draft.auth);
	const headers = draft.headers.map(redactRow);
	const params = draft.params.map(redactRow);
	const url = redactUrl(draft.url);
	const same =
		auth === draft.auth &&
		url === draft.url &&
		headers.every((row, index) => row === draft.headers[index]) &&
		params.every((row, index) => row === draft.params[index]);
	return same ? draft : { ...draft, auth, headers, params, url };
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
