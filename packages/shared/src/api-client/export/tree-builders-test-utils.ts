/** Builders of collection trees for the export tests; ids are a counter. */
import type { ExampleResponse } from "../collections/collection-model.js";
import type {
	ImportedExample,
	ImportedFolder,
	ImportedItem,
	ImportedRequest,
} from "../import/imported-collection.js";
import {
	type ApiRequestDraft,
	type KeyValueRow,
	type RequestBody,
	createRequestDraft,
	emptyRequestBody,
} from "../request-model.js";

let counter = 0;
const nextId = (): string => `x${++counter}`;

export function row(
	key: string,
	value: string,
	extra: Partial<KeyValueRow> = {},
): KeyValueRow {
	return { id: nextId(), key, value, enabled: true, ...extra };
}

export const body = (fields: Partial<RequestBody>): RequestBody => ({
	...emptyRequestBody(),
	...fields,
});

/** A request that inherits auth unless `draft` sets it. */
export function request(
	name: string,
	draft: Partial<ApiRequestDraft>,
	extra: Partial<Pick<ImportedRequest, "description" | "examples">> = {},
): ImportedRequest {
	return {
		kind: "request",
		id: nextId(),
		name,
		description: "",
		draft: createRequestDraft({ name, auth: { type: "inherit" }, ...draft }),
		examples: [],
		...extra,
	};
}

/** The example's request is named after it, as import names it. */
export function example(
	name: string,
	draft: Partial<ApiRequestDraft>,
	response: Partial<ExampleResponse>,
): ImportedExample {
	return {
		id: nextId(),
		name,
		request: createRequestDraft({ name, ...draft }),
		response: {
			status: 200,
			statusText: "OK",
			headers: [],
			body: "",
			bodyLanguage: "text",
			...response,
		},
	};
}

export function folder(
	name: string,
	fields: Partial<ImportedFolder>,
	items: ImportedItem[],
): ImportedFolder {
	return {
		kind: "folder",
		id: nextId(),
		name,
		description: "",
		auth: { type: "inherit" },
		scripts: { pre: "", post: "" },
		...fields,
		items,
	};
}
