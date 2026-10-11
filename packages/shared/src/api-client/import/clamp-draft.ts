/**
 * Keeps an imported draft inside the limits `apiRequestDraftSchema`
 * enforces when it is saved: table sizes, the length of the name, URL,
 * every row field and auth field, and scripts (a script over the limit is
 * dropped, as half a script would not run).
 */
import {
	MAX_HEADERS,
	MAX_HEADER_NAME_LENGTH,
	MAX_HEADER_VALUE_LENGTH,
	MAX_REQUEST_NAME_LENGTH,
	MAX_ROW_KEY_LENGTH,
	MAX_ROW_VALUE_LENGTH,
	MAX_SCRIPT_LENGTH,
	MAX_TABLE_ROWS,
	MAX_URL_LENGTH,
} from "../limits.js";
import type {
	ApiRequestDraft,
	KeyValueRow,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import { fitText } from "./fit-text.js";
import type { ImportContext } from "./import-context.js";

/** The first `max` rows; calls `warn` when some are dropped. */
export function capRows<T extends KeyValueRow>(
	rows: T[],
	max: number,
	warn: () => void,
): T[] {
	if (rows.length <= max) return rows;
	warn();
	return rows.slice(0, max);
}

/** At most `max` rows, each key, value and description within limits. */
export function fitRows<T extends KeyValueRow>(
	rows: T[],
	max: number,
	ctx: ImportContext,
	path: string,
): T[] {
	const fit = (text: string, limit: number) => fitText(text, limit, ctx, path);
	const kept = capRows(rows, max, () => ctx.warn("TRUNCATED", path, { max }));
	return kept.map((row) => {
		const out: T = {
			...row,
			key: fit(row.key, MAX_ROW_KEY_LENGTH),
			value: fit(row.value, MAX_ROW_VALUE_LENGTH),
		};
		if (row.description !== undefined) {
			out.description = fit(row.description, MAX_ROW_KEY_LENGTH);
		}
		return out;
	});
}

function fitAuth(
	auth: RequestAuth,
	ctx: ImportContext,
	path: string,
): RequestAuth {
	const secret = (text: string) =>
		fitText(text, MAX_HEADER_VALUE_LENGTH, ctx, path);
	switch (auth.type) {
		case "inherit":
		case "none":
			return auth;
		case "bearer":
			return { ...auth, token: secret(auth.token) };
		case "basic":
			return {
				...auth,
				username: fitText(auth.username, MAX_ROW_KEY_LENGTH, ctx, path),
				password: secret(auth.password),
			};
		case "apikey":
			return {
				...auth,
				key: fitText(auth.key, MAX_HEADER_NAME_LENGTH, ctx, path),
				value: secret(auth.value),
			};
	}
}

/** Scripts over `MAX_SCRIPT_LENGTH` are dropped with a warning. */
export function fitScripts(
	scripts: RequestScripts,
	ctx: ImportContext,
	path: string,
): RequestScripts {
	const fit = (text: string): string => {
		if (text.length <= MAX_SCRIPT_LENGTH) return text;
		ctx.warn("TRUNCATED", path, { max: MAX_SCRIPT_LENGTH });
		return "";
	};
	return { pre: fit(scripts.pre), post: fit(scripts.post) };
}

export function clampDraft(
	draft: ApiRequestDraft,
	ctx: ImportContext,
	path: string,
): ApiRequestDraft {
	return {
		...draft,
		name: fitText(draft.name, MAX_REQUEST_NAME_LENGTH, ctx, path),
		url: fitText(draft.url, MAX_URL_LENGTH, ctx, path),
		params: fitRows(draft.params, MAX_TABLE_ROWS, ctx, path),
		headers: fitRows(draft.headers, MAX_HEADERS, ctx, path),
		auth: fitAuth(draft.auth, ctx, path),
		body: {
			...draft.body,
			urlencoded: fitRows(draft.body.urlencoded, MAX_TABLE_ROWS, ctx, path),
			formData: fitRows(draft.body.formData, MAX_TABLE_ROWS, ctx, path),
		},
		scripts: fitScripts(draft.scripts, ctx, path),
	};
}
