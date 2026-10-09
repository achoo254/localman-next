/**
 * Unique `{{name}}` names a request uses across URL, params, headers, the
 * active body and the auth fields, in order of first appearance.
 *
 * Unlike the old client this scans bodies of any size: skipping a large
 * body would hide a secret in it and let the request reach the proxy
 * without asking.
 */
import type { ApiRequestDraft, KeyValueRow } from "./request-model.js";
import { VARIABLE_PATTERN } from "./variable-interpolation.js";

export function extractUsedVariables(
	request: ApiRequestDraft | null,
): string[] {
	if (!request) return [];
	const seen = new Set<string>();

	const scan = (text: string | undefined): void => {
		if (!text) return;
		for (const match of text.matchAll(VARIABLE_PATTERN)) {
			const name = (match[1] ?? "").trim();
			if (name) seen.add(name);
		}
	};
	const scanRows = (rows: readonly KeyValueRow[]): void => {
		for (const row of rows) {
			scan(row.key);
			scan(row.value);
		}
	};

	scan(request.url);
	scanRows(request.params);
	scanRows(request.headers);

	const { body, auth } = request;
	if (body.type === "raw") scan(body.raw);
	if (body.type === "urlencoded") scanRows(body.urlencoded);
	if (body.type === "formdata") {
		for (const row of body.formData) {
			scan(row.key);
			if (row.kind === "text") scan(row.value);
		}
	}

	if (auth.type === "bearer") scan(auth.token);
	if (auth.type === "basic") {
		scan(auth.username);
		scan(auth.password);
	}
	if (auth.type === "apikey") {
		scan(auth.key);
		scan(auth.value);
	}
	return [...seen];
}
