import {
	type JsonObject,
	type JsonValue,
	OBJECT_ID_FIELD,
	RELATION_FIELD_TYPES,
	type ResourceField,
} from "@localman/shared";
import type {
	ApiRequestDraft,
	CollectionNode,
} from "@localman/shared/api-client";
import { type MockScope, exampleKey } from "./sync-keys.js";

/**
 * A placeholder value per field type. Fixed values, not generated data:
 * the same schema always gives the same sample, so a sync only changes a
 * request's body or example when the schema changed.
 */
function sampleOf(field: ResourceField): JsonValue {
	switch (field.type) {
		case "Number":
			return 0;
		case "Boolean":
			return false;
		case "Object":
			return {};
		case "Array":
			return [];
		case "Date":
			return "2026-01-01T00:00:00.000Z";
		default:
			return "";
	}
}

/** The fields a client sends (no `id`, no relation fields), in order. */
export function bodySample(schema: readonly ResourceField[]): JsonObject {
	const body: JsonObject = {};
	for (const field of schema) {
		if (field.name === OBJECT_ID_FIELD) continue;
		if (RELATION_FIELD_TYPES.has(field.type)) continue;
		body[field.name] = sampleOf(field);
	}
	return body;
}

/** One record as the mock answers it: `id` first, then the body fields. */
export function recordSample(schema: readonly ResourceField[]): JsonObject {
	return { [OBJECT_ID_FIELD]: "1", ...bodySample(schema) };
}

export const prettyJson = (value: JsonValue): string =>
	JSON.stringify(value, null, 2);

/** The example answer of a GET: the list or one record, from the schema. */
export function exampleOf(
	requestId: string,
	draft: ApiRequestDraft,
	scope: MockScope,
	schema: readonly ResourceField[],
): CollectionNode {
	const record = recordSample(schema);
	return {
		kind: "example",
		id: exampleKey(requestId),
		parentId: requestId,
		order: "a0",
		name: "200 OK",
		request: draft,
		response: {
			status: 200,
			statusText: "OK",
			headers: [
				{
					id: "content-type",
					key: "Content-Type",
					value: "application/json",
					enabled: true,
				},
			],
			body: prettyJson(scope === "collection" ? [record] : record),
			bodyLanguage: "json",
		},
	};
}
