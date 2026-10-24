/**
 * Credentials a request carries, named for the router: what it asks about
 * before it switches a request to the proxy or a tunnel on its own. The
 * Authorization tab, headers and query params whose name says credential
 * (`isSensitiveName`, shared with history and the public views of a
 * collection), and `{{var}}` values of secret variables.
 */
import {
	type ApiRequestDraft,
	type PreparedRequest,
	isSensitiveName,
	parseHttpUrl,
} from "@localman/shared/api-client";

/** Query params of the prepared URL whose name holds a credential. */
function sensitiveQuery(url: string): string[] {
	const parsed = parseHttpUrl(url);
	if (!parsed) return [];
	const names: string[] = [];
	parsed.searchParams.forEach((value, name) => {
		if (value.trim() !== "" && isSensitiveName(name)) names.push(`?${name}`);
	});
	return names;
}

/** The texts of a prepared request a value can be copied into. */
function preparedTexts(prepared: PreparedRequest): string[] {
	return [
		prepared.url,
		...prepared.headers.map((header) => header.value),
		prepared.body.kind === "text" ? prepared.body.text : "",
	];
}

/**
 * Names to show (`Authorization`, `X-API-Key`, `?access_token`, `{{token}}`),
 * no values. `vault`: values of the vault open now; one copied into the
 * request by another way than its `{{name}}` (a script, a temporary
 * variable) counts as that secret too.
 */
export function sensitiveParts(
	draft: ApiRequestDraft,
	prepared: PreparedRequest,
	vault: readonly { name: string; value: string }[] = [],
): string[] {
	const parts: string[] = [];
	const add = (name: string): void => {
		const lower = name.toLowerCase();
		if (!parts.some((part) => part.toLowerCase() === lower)) parts.push(name);
	};
	for (const { name, value } of prepared.headers) {
		if (value.trim() !== "" && isSensitiveName(name)) add(name.trim());
	}
	// An API key set in the Authorization tab counts whatever its name.
	if (draft.auth.type === "apikey" && draft.auth.key.trim()) {
		const key = draft.auth.key.trim();
		add(draft.auth.in === "query" ? `?${key}` : key);
	}
	for (const name of sensitiveQuery(prepared.url)) add(name);
	for (const name of prepared.secretsUsed) add(`{{${name}}}`);
	const texts = preparedTexts(prepared);
	for (const { name, value } of vault) {
		if (texts.some((text) => text.includes(value))) add(`{{${name}}}`);
	}
	return parts;
}
