/**
 * Collection variables written into a request when it opens as a tab: the
 * client has no collection scope yet (phase 12/13), so `{{baseUrl}}` of an
 * imported collection is replaced by its value. Single pass, like the
 * interpolator: a value holding `{{x}}` is not expanded again, and unknown
 * or dynamic names (`{{$guid}}`) stay as typed.
 */
import type {
	ApiRequestDraft,
	FormDataRow,
	KeyValueRow,
	RequestAuth,
} from "../request-model.js";
import {
	VARIABLE_PATTERN,
	type VariableEntry,
} from "../variable-interpolation.js";

type Fill = (text: string) => string;

function fillRows<T extends KeyValueRow>(rows: readonly T[], fill: Fill): T[] {
	return rows.map((row) => ({
		...row,
		key: fill(row.key),
		value: fill(row.value),
	}));
}

function fillAuth(auth: RequestAuth, fill: Fill): RequestAuth {
	switch (auth.type) {
		case "bearer":
			return { ...auth, token: fill(auth.token) };
		case "basic":
			return {
				...auth,
				username: fill(auth.username),
				password: fill(auth.password),
			};
		case "apikey":
			return { ...auth, key: fill(auth.key), value: fill(auth.value) };
		default:
			return auth;
	}
}

/** The draft with every enabled variable of `variables` filled in. */
export function applyCollectionVariables(
	draft: ApiRequestDraft,
	variables: readonly VariableEntry[],
): ApiRequestDraft {
	const values = new Map<string, string>();
	for (const variable of variables) {
		if (variable.enabled !== false)
			values.set(variable.key.trim(), variable.value);
	}
	if (values.size === 0) return draft;
	const fill: Fill = (text) =>
		text.replace(VARIABLE_PATTERN, (match, name: string) => {
			const value = values.get(name.trim());
			return value === undefined ? match : value;
		});
	const formData: FormDataRow[] = draft.body.formData.map((row) =>
		row.kind === "text"
			? { ...row, key: fill(row.key), value: fill(row.value) }
			: { ...row, key: fill(row.key) },
	);
	return {
		...draft,
		url: fill(draft.url),
		params: fillRows(draft.params, fill),
		headers: fillRows(draft.headers, fill),
		auth: fillAuth(draft.auth, fill),
		body: {
			...draft.body,
			raw: fill(draft.body.raw),
			urlencoded: fillRows(draft.body.urlencoded, fill),
			formData,
		},
	};
}
