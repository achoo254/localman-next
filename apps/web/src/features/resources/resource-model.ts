import {
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	FIELD_TYPES,
	type FieldType,
} from "@localman/shared/constants";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";

/** Resources of a mock project as the dashboard API returns them. */

export type EndpointMethod = (typeof ENDPOINT_METHODS)[number];
export type EndpointPath = (typeof ENDPOINT_PATHS)[number];

export interface SchemaField {
	name: string;
	type: FieldType;
	fakerMethod?: string;
	childId?: string;
}

export interface ResourceEndpoint {
	method: EndpointMethod;
	path: EndpointPath;
	enabled: boolean;
	/** JSON response template (`"$mockData"` by default). */
	response: unknown;
}

export interface Resource {
	id: string;
	parentId: string | null;
	name: string;
	/** Generated parent id field (`userId`), null for a root resource. */
	parentKey: string | null;
	schema: SchemaField[];
	template: JsonRecord | null;
	endpoints: ResourceEndpoint[];
	count: number;
}

/** Body of create (with `parentId`) and update (without). */
export interface ResourceInput {
	name: string;
	parentId?: string | null;
	schema: SchemaField[];
	template: JsonRecord | null;
	endpoints: ResourceEndpoint[];
}

/** A resource whose record count a write changes (dry runs included). */
export interface DataChange {
	resourceId: string;
	name: string;
	countBefore: number;
	countAfter: number;
}

function oneOf<T extends string>(
	values: readonly T[],
	value: string,
	what: string,
): T {
	const found = values.find((candidate) => candidate === value);
	if (found === undefined) throw new InvalidResponseError(what);
	return found;
}

function parseField(value: unknown): SchemaField {
	const data = expectRecord(value, "schema field");
	const fakerMethod = optionalString(data, "fakerMethod");
	const childId = optionalString(data, "childId");
	return {
		name: expectString(data, "name"),
		type: oneOf(FIELD_TYPES, expectString(data, "type"), "field type"),
		...(fakerMethod === null ? {} : { fakerMethod }),
		...(childId === null ? {} : { childId }),
	};
}

function parseEndpoint(value: unknown): ResourceEndpoint {
	const data = expectRecord(value, "endpoint");
	return {
		method: oneOf(ENDPOINT_METHODS, expectString(data, "method"), "method"),
		path: oneOf(ENDPOINT_PATHS, expectString(data, "path"), "path"),
		enabled: expectBoolean(data, "enabled"),
		response: data.response,
	};
}

export function parseResource(value: unknown): Resource {
	const data = expectRecord(value, "resource");
	const template = data.template;
	if (template !== null && !isRecord(template)) {
		throw new InvalidResponseError("template");
	}
	return {
		id: expectString(data, "id"),
		parentId: optionalString(data, "parentId"),
		name: expectString(data, "name"),
		parentKey: optionalString(data, "parentKey"),
		schema: expectArray(data, "schema").map(parseField),
		template,
		endpoints: expectArray(data, "endpoints").map(parseEndpoint),
		count: expectNumber(data, "count"),
	};
}

export function parseChanges(value: unknown): DataChange[] {
	const data = expectRecord(value, "data changes");
	return expectArray(data, "changes").map((item) => {
		const change = expectRecord(item, "change");
		return {
			resourceId: expectString(change, "resourceId"),
			name: expectString(change, "name"),
			countBefore: expectNumber(change, "countBefore"),
			countAfter: expectNumber(change, "countAfter"),
		};
	});
}
