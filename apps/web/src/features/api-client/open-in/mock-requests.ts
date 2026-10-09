/**
 * Requests of a mock project for the API client, built from the project's
 * mock URLs (`GET /projects/:projectId/mock-urls`, the single source of
 * the paths: prefix, nesting and enabled endpoints). Pure, so the project
 * page action, "From mock project" and later the saved collection share
 * one mapping.
 *
 * Record ids in the paths become `{{id}}` / `{{userId}}` variables. The
 * mock addresses the project by the secret already inside the base URL,
 * so no header is added.
 */
import {
	type ApiRequestDraft,
	type HttpMethod,
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";

export interface MockEndpointUrl {
	method: string;
	/** Absolute URL with `{id}`-style placeholders. */
	url: string;
}

export interface MockResourceUrls {
	id: string;
	name: string;
	parentId: string | null;
	depth: number;
	collectionUrl: string;
	itemUrl: string;
	/** Enabled endpoints only; PATCH shares the PUT endpoint. */
	endpoints: MockEndpointUrl[];
}

export interface MockUrls {
	projectId: string;
	mockBaseUrl: string;
	/** In tree order: a parent before its children. */
	resources: MockResourceUrls[];
}

export const MOCK_REQUEST_KINDS = [
	"list",
	"get",
	"create",
	"update",
	"patch",
	"delete",
] as const;
export type MockRequestKind = (typeof MOCK_REQUEST_KINDS)[number];

/** Collection URL (`/users`) or item URL (`/users/{id}`). */
export type MockRequestScope = "collection" | "item";

export interface MockRequest {
	/** Stable across runs: `mock:<resourceId>:<method>:<scope>`. */
	id: string;
	resourceId: string;
	kind: MockRequestKind;
	draft: ApiRequestDraft;
}

/** Name of a request in the language on screen, e.g. "List users". */
export type MockRequestNamer = (
	kind: MockRequestKind,
	resourceName: string,
) => string;

const CRUD_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
] as const satisfies readonly HttpMethod[];
type CrudMethod = (typeof CRUD_METHODS)[number];

function isCrudMethod(method: string): method is CrudMethod {
	return CRUD_METHODS.some((crud) => crud === method);
}

const KIND_OF_WRITE: Record<Exclude<CrudMethod, "GET">, MockRequestKind> = {
	POST: "create",
	PUT: "update",
	PATCH: "patch",
	DELETE: "delete",
};

const WITH_BODY: ReadonlySet<MockRequestKind> = new Set([
	"create",
	"update",
	"patch",
]);

/** `{id}` placeholders as `{{id}}` variables; `{{name}}` stays as is. */
export function toVariableUrl(url: string): string {
	return url.replace(/(?<!\{)\{([A-Za-z_]\w*)\}(?!\})/g, "{{$1}}");
}

function kindOf(method: CrudMethod, scope: MockRequestScope): MockRequestKind {
	if (method === "GET") return scope === "collection" ? "list" : "get";
	return KIND_OF_WRITE[method];
}

function buildRequest(
	resource: MockResourceUrls,
	method: CrudMethod,
	scope: MockRequestScope,
	nameOf: MockRequestNamer,
): MockRequest {
	const kind = kindOf(method, scope);
	const url =
		scope === "collection" ? resource.collectionUrl : resource.itemUrl;
	const body = WITH_BODY.has(kind)
		? { ...emptyRequestBody(), type: "raw" as const, raw: "{}" }
		: emptyRequestBody();
	return {
		id: `mock:${resource.id}:${method}:${scope}`,
		resourceId: resource.id,
		kind,
		draft: createRequestDraft({
			name: nameOf(kind, resource.name),
			method,
			url: toVariableUrl(url),
			body,
		}),
	};
}

/** GET of the resource's collection: what "Open in API Client" opens. */
export function listRequestOf(
	resource: MockResourceUrls,
	nameOf: MockRequestNamer,
): MockRequest {
	return buildRequest(resource, "GET", "collection", nameOf);
}

/** One request per enabled endpoint of every resource, in tree order. */
export function mockRequestsOf(
	urls: MockUrls,
	nameOf: MockRequestNamer,
): MockRequest[] {
	return urls.resources.flatMap((resource) =>
		resource.endpoints.flatMap((endpoint) => {
			const method = endpoint.method.toUpperCase();
			if (!isCrudMethod(method)) return [];
			const scope: MockRequestScope =
				endpoint.url === resource.collectionUrl ? "collection" : "item";
			return [buildRequest(resource, method, scope, nameOf)];
		}),
	);
}

/** The requests that fit in `room` free tabs, and how many were left out. */
export function fitTabs(
	requests: readonly MockRequest[],
	room: number,
): { opened: MockRequest[]; skipped: number } {
	const opened = requests.slice(0, Math.max(0, room));
	return { opened, skipped: requests.length - opened.length };
}
