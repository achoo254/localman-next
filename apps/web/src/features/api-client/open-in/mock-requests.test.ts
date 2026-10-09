import { describe, expect, it } from "vitest";
import {
	type MockResourceUrls,
	type MockUrls,
	fitTabs,
	listRequestOf,
	mockRequestsOf,
	toVariableUrl,
} from "./mock-requests";
import { readOpenInApiClient } from "./open-in-state";

const BASE = "https://abc123.mock.localman.test/api/v1";
const nameOf = (kind: string, name: string) => `${kind} ${name}`;

function resource(
	id: string,
	collectionPath: string,
	methods: [string, "collection" | "item"][],
	parentId: string | null = null,
): MockResourceUrls {
	const collectionUrl = `${BASE}${collectionPath}`;
	const itemUrl = `${collectionUrl}/{id}`;
	return {
		id,
		name: id,
		parentId,
		depth: parentId ? 1 : 0,
		collectionUrl,
		itemUrl,
		endpoints: methods.map(([method, scope]) => ({
			method,
			url: scope === "collection" ? collectionUrl : itemUrl,
		})),
	};
}

const CRUD: [string, "collection" | "item"][] = [
	["GET", "collection"],
	["GET", "item"],
	["POST", "collection"],
	["PUT", "item"],
	["PATCH", "item"],
	["DELETE", "item"],
];

const URLS: MockUrls = {
	projectId: "p1",
	mockBaseUrl: BASE,
	resources: [
		resource("users", "/users", CRUD),
		resource("posts", "/users/{userId}/posts", CRUD, "users"),
	],
};

describe("mock project requests", () => {
	it("maps every enabled endpoint to a CRUD request with a stable id", () => {
		const requests = mockRequestsOf(URLS, nameOf);
		expect(requests.map((request) => request.id).slice(0, 6)).toEqual([
			"mock:users:GET:collection",
			"mock:users:GET:item",
			"mock:users:POST:collection",
			"mock:users:PUT:item",
			"mock:users:PATCH:item",
			"mock:users:DELETE:item",
		]);
		expect(
			requests.slice(0, 6).map(({ kind, draft }) => [kind, draft.name]),
		).toEqual([
			["list", "list users"],
			["get", "get users"],
			["create", "create users"],
			["update", "update users"],
			["patch", "patch users"],
			["delete", "delete users"],
		]);
	});

	it("turns path params into {{variables}}, nested resources included", () => {
		const posts = mockRequestsOf(URLS, nameOf).filter(
			(request) => request.resourceId === "posts",
		);
		expect(posts.map(({ draft }) => `${draft.method} ${draft.url}`)).toEqual([
			`GET ${BASE}/users/{{userId}}/posts`,
			`GET ${BASE}/users/{{userId}}/posts/{{id}}`,
			`POST ${BASE}/users/{{userId}}/posts`,
			`PUT ${BASE}/users/{{userId}}/posts/{{id}}`,
			`PATCH ${BASE}/users/{{userId}}/posts/{{id}}`,
			`DELETE ${BASE}/users/{{userId}}/posts/{{id}}`,
		]);
	});

	it("keeps the secret in the base URL only: no header, no auth", () => {
		for (const { draft } of mockRequestsOf(URLS, nameOf)) {
			expect(draft.url.startsWith(`${BASE}/`)).toBe(true);
			expect(draft.headers).toEqual([]);
			expect(draft.params).toEqual([]);
			expect(draft.auth).toEqual({ type: "none" });
		}
	});

	it("gives writes an empty JSON body and reads no body", () => {
		const byKind = new Map(
			mockRequestsOf(URLS, nameOf).map((request) => [request.kind, request]),
		);
		expect(byKind.get("create")?.draft.body).toMatchObject({
			type: "raw",
			rawLanguage: "json",
			raw: "{}",
		});
		expect(byKind.get("patch")?.draft.body.type).toBe("raw");
		expect(byKind.get("list")?.draft.body.type).toBe("none");
		expect(byKind.get("delete")?.draft.body.type).toBe("none");
	});

	it("skips disabled and unknown endpoints", () => {
		const onlyReads = resource("tags", "/tags", [
			["GET", "collection"],
			["HEAD", "collection"],
		]);
		const requests = mockRequestsOf(
			{ ...URLS, resources: [onlyReads] },
			nameOf,
		);
		expect(requests.map((request) => request.id)).toEqual([
			"mock:tags:GET:collection",
		]);
	});

	it("opens one resource as its list request even when GET is disabled", () => {
		const writeOnly = resource("logs", "/users/{userId}/logs", [
			["POST", "collection"],
		]);
		const request = listRequestOf(writeOnly, nameOf);
		expect(request.id).toBe("mock:logs:GET:collection");
		expect(request.draft).toMatchObject({
			method: "GET",
			url: `${BASE}/users/{{userId}}/logs`,
			name: "list logs",
		});
	});

	it("leaves {{variables}} that are already there", () => {
		expect(toVariableUrl("https://x.test/{{base}}/a/{id}")).toBe(
			"https://x.test/{{base}}/a/{{id}}",
		);
	});
});

describe("tab room", () => {
	const requests = mockRequestsOf(URLS, nameOf);

	it("opens what fits and counts the rest", () => {
		const { opened, skipped } = fitTabs(requests, 2);
		expect(opened.map((request) => request.id)).toEqual([
			"mock:users:GET:collection",
			"mock:users:GET:item",
		]);
		expect(skipped).toBe(10);
	});

	it("opens nothing without room", () => {
		expect(fitTabs(requests, -3)).toEqual({ opened: [], skipped: 12 });
		expect(fitTabs(requests, 50).skipped).toBe(0);
	});
});

describe("navigation state", () => {
	it("reads a project or a resource target", () => {
		const state = { openInApiClient: { projectId: "p1", resourceId: "r1" } };
		expect(readOpenInApiClient(state)).toEqual({
			projectId: "p1",
			resourceId: "r1",
		});
		expect(
			readOpenInApiClient({ openInApiClient: { projectId: "p1" } }),
		).toEqual({ projectId: "p1" });
	});

	it("ignores anything else", () => {
		for (const state of [
			null,
			"p1",
			{ openInApiClient: null },
			{ openInApiClient: { projectId: "../admin" } },
			{ openInApiClient: { projectId: "p1", resourceId: 7 } },
			{ openInApiClient: { projectId: "x".repeat(65) } },
		]) {
			expect(readOpenInApiClient(state)).toBeNull();
		}
	});
});
