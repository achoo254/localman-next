import {
	DEFAULT_RESOURCE_FIELDS,
	DEFAULT_RESPONSE,
	type FieldType,
	RESOURCE_ENDPOINTS,
} from "@localman/shared/constants";
import {
	type ChaosDraft,
	type RuleDraft,
	chaosDraftOf,
	ruleDraft,
} from "./endpoint-behavior-draft";
import type {
	EndpointMethod,
	EndpointPath,
	Resource,
	ResourceEndpoint,
	SchemaField,
} from "./resource-model";

/** Default method of a new Faker.js field, as in the prototype. */
export const DEFAULT_FAKER_METHOD = "lorem.word";

/**
 * Who picked the Faker method: the saved schema (or a default field), the
 * name matcher, the user, or nobody yet (a new field). Client-only.
 */
export type MethodSource = "saved" | "suggested" | "user" | "default";

export interface FieldDraft {
	/** Stable React key; not sent. */
	key: string;
	name: string;
	type: FieldType;
	fakerMethod: string;
	childId: string;
	methodSource: MethodSource;
	/** Name the field was loaded with; renaming it allows a new suggestion. */
	savedName: string | null;
}

/** Disclosure of an endpoint card: its rules, its chaos, or neither. */
export type EndpointPanel = "rules" | "chaos" | null;

export interface EndpointDraft {
	method: EndpointMethod;
	path: EndpointPath;
	enabled: boolean;
	/** Response template as JSON text. */
	response: string;
	chaos: ChaosDraft;
	rules: RuleDraft[];
	panel: EndpointPanel;
}

export interface ResourceDraft {
	name: string;
	/** `{parent}Id` field of a nested resource; empty on a root one. */
	parentKey: string;
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
	parentKey?: string;
	schema?: string;
	/** By `FieldDraft.key`. */
	fields: Record<string, string>;
	template?: string;
	/** By `endpointKey`. */
	endpoints: Record<string, string>;
	/** Chaos and rule errors by `endpointKey`. */
	behavior: Record<string, BehaviorErrors>;
}

export type ChaosPart =
	| "min"
	| "max"
	| "errorRate"
	| "timeoutRate"
	| "rateLimitRate"
	| "rates";
export type RulePart = "target" | "value" | "status" | "headers" | "body";

export interface BehaviorErrors {
	chaos: Partial<Record<ChaosPart, string>>;
	/** By `RuleDraft.key`. */
	rules: Record<string, Partial<Record<RulePart, string>>>;
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
		methodSource: field ? "saved" : "default",
		savedName: field?.name ?? null,
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
		parentKey: resource?.parentKey ?? "",
		fields: (resource?.schema ?? DEFAULT_RESOURCE_FIELDS).map(fieldDraft),
		template: resource?.template ? jsonText(resource.template) : "",
		endpoints: endpoints.map((endpoint) => ({
			method: endpoint.method,
			path: endpoint.path,
			enabled: endpoint.enabled,
			response: jsonText(endpoint.response),
			chaos: chaosDraftOf(endpoint.chaos),
			rules: (endpoint.rules ?? []).map((rule) => ruleDraft(rule)),
			panel: null,
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
