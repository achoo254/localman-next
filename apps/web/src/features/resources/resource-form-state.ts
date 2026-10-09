import {
	DEFAULT_RESOURCE_FIELDS,
	DEFAULT_RESPONSE,
	type FieldType,
	RESOURCE_ENDPOINTS,
} from "@localman/shared/constants";
import type {
	EndpointMethod,
	EndpointPath,
	Resource,
	ResourceEndpoint,
	SchemaField,
} from "./resource-model";

/** Default method of a new Faker.js field, as in the prototype. */
export const DEFAULT_FAKER_METHOD = "lorem.word";

export interface FieldDraft {
	/** Stable React key; not sent. */
	key: string;
	name: string;
	type: FieldType;
	fakerMethod: string;
	childId: string;
}

export interface EndpointDraft {
	method: EndpointMethod;
	path: EndpointPath;
	enabled: boolean;
	/** Response template as JSON text. */
	response: string;
}

export interface ResourceDraft {
	name: string;
	fields: FieldDraft[];
	/** Object template as JSON text; empty means "use the schema". */
	template: string;
	endpoints: EndpointDraft[];
}

/** Where the resource sits, which decides reserved names and relation types. */
export interface FormPlace {
	parentKey: string | null;
	parentName: string | null;
	children: ReadonlyArray<{ id: string; name: string }>;
	/** Names of the other resources under the same parent. */
	siblingNames: readonly string[];
}

export interface DraftErrors {
	name?: string;
	schema?: string;
	/** By `FieldDraft.key`. */
	fields: Record<string, string>;
	template?: string;
	/** By `endpointKey`. */
	endpoints: Record<string, string>;
}

let lastKey = 0;
const newKey = (): string => {
	lastKey += 1;
	return `field-${lastKey}`;
};

export const endpointKey = (endpoint: { method: string; path: string }) =>
	`${endpoint.method} ${endpoint.path}`;

export function fieldDraft(field?: SchemaField): FieldDraft {
	return {
		key: newKey(),
		name: field?.name ?? "",
		type: field?.type ?? "Faker.js",
		fakerMethod: field?.fakerMethod ?? DEFAULT_FAKER_METHOD,
		childId: field?.childId ?? "",
	};
}

const jsonText = (value: unknown): string =>
	JSON.stringify(value === undefined ? DEFAULT_RESPONSE : value, null, 2);

export function draftOf(resource: Resource | null): ResourceDraft {
	const endpoints: readonly ResourceEndpoint[] =
		resource?.endpoints ??
		RESOURCE_ENDPOINTS.map((endpoint) => ({
			...endpoint,
			enabled: true,
			response: DEFAULT_RESPONSE,
		}));
	return {
		name: resource?.name ?? "",
		fields: (resource?.schema ?? DEFAULT_RESOURCE_FIELDS).map(fieldDraft),
		template: resource?.template ? jsonText(resource.template) : "",
		endpoints: endpoints.map((endpoint) => ({
			method: endpoint.method,
			path: endpoint.path,
			enabled: endpoint.enabled,
			response: jsonText(endpoint.response),
		})),
	};
}

/** Parent, children and sibling names of `resource` (null = new root). */
export function placeOf(
	resource: Resource | null,
	resources: readonly Resource[],
): FormPlace {
	const parentId = resource?.parentId ?? null;
	const parent = resources.find((item) => item.id === parentId) ?? null;
	return {
		parentKey: resource?.parentKey ?? null,
		parentName: parent?.name ?? null,
		children: resource
			? resources.filter((item) => item.parentId === resource.id)
			: [],
		siblingNames: resources
			.filter((item) => item.parentId === parentId && item.id !== resource?.id)
			.map((item) => item.name),
	};
}
