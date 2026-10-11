import { describe, expect, it } from "vitest";
import {
	type RequestAuth,
	type RequestScripts,
	createRequestDraft,
} from "../request-model.js";
import type {
	CollectionDetail,
	CollectionFolderNode,
	CollectionNode,
	CollectionRequestNode,
} from "./collection-model.js";
import { requestContext } from "./request-context.js";

const scripts = (pre: string, post = ""): RequestScripts => ({ pre, post });

function folder(
	id: string,
	parentId: string | null,
	auth: RequestAuth = { type: "inherit" },
	own: RequestScripts = scripts(""),
): CollectionFolderNode {
	const base = { id, parentId, order: "a0", name: id.toUpperCase() };
	return { ...base, kind: "folder", description: "", auth, scripts: own };
}

function request(
	id: string,
	parentId: string | null,
	own: RequestScripts = scripts(""),
): CollectionRequestNode {
	const draft = createRequestDraft({ name: id, scripts: own });
	const base = { id, parentId, order: "a0", name: id };
	return { ...base, kind: "request", description: "", draft };
}

function collection(nodes: CollectionNode[]): CollectionDetail {
	return {
		id: "c1",
		workspaceId: "w1",
		role: "editor",
		name: "Shop",
		description: "",
		auth: { type: "bearer", token: "{{token}}" },
		scripts: scripts("c-pre", "c-post"),
		variables: [{ key: "baseUrl", value: "https://a.test" }],
		createdBy: "u1",
		createdAt: "2026-10-11T00:00:00.000Z",
		updatedAt: "2026-10-11T00:00:00.000Z",
		nodes,
	};
}

const basic: RequestAuth = { type: "basic", username: "u", password: "p" };

describe("requestContext", () => {
	it("uses the collection's auth and scripts at the top level", () => {
		const detail = collection([request("r1", null, scripts("r-pre"))]);
		expect(requestContext(detail, "r1")).toEqual({
			inheritedAuth: { type: "bearer", token: "{{token}}" },
			authSource: { kind: "collection", id: "c1", name: "Shop" },
			preScripts: ["c-pre", "r-pre"],
			postScripts: ["c-post"],
			variables: [{ key: "baseUrl", value: "https://a.test" }],
			folderPath: [],
		});
	});

	it("takes auth from the nearest folder that sets one", () => {
		const detail = collection([
			folder("f1", null, basic),
			folder("f2", "f1"),
			folder("f3", "f2"),
			request("r1", "f3"),
		]);
		const context = requestContext(detail, "r1");
		expect(context?.inheritedAuth).toEqual(basic);
		expect(context?.authSource).toEqual({
			kind: "folder",
			id: "f1",
			name: "F1",
		});
		expect(context?.folderPath.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
	});

	it("lets an inner folder's none override an outer folder", () => {
		const detail = collection([
			folder("f1", null, basic),
			folder("f2", "f1", { type: "none" }),
			request("r1", "f2"),
		]);
		const context = requestContext(detail, "r1");
		expect(context?.inheritedAuth).toEqual({ type: "none" });
		expect(context?.authSource.id).toBe("f2");
	});

	it("runs scripts collection first, then folders outer to inner", () => {
		const detail = collection([
			folder("f1", null, undefined, scripts("f1-pre", "f1-post")),
			folder("f2", "f1", undefined, scripts("  ", "f2-post")),
			request("r1", "f2", scripts("r-pre", "r-post")),
		]);
		const context = requestContext(detail, "r1");
		expect(context?.preScripts).toEqual(["c-pre", "f1-pre", "r-pre"]);
		expect(context?.postScripts).toEqual([
			"c-post",
			"f1-post",
			"f2-post",
			"r-post",
		]);
	});

	it("uses the given scripts instead of the stored request's", () => {
		const detail = collection([request("r1", null, scripts("stored"))]);
		const context = requestContext(detail, "r1", scripts("edited", "post"));
		expect(context?.preScripts).toEqual(["c-pre", "edited"]);
		expect(context?.postScripts).toEqual(["c-post", "post"]);
	});

	it("treats a missing parent as the top level", () => {
		const detail = collection([
			folder("f1", "gone", basic),
			request("r1", "f1"),
		]);
		const context = requestContext(detail, "r1");
		expect(context?.folderPath.map((f) => f.id)).toEqual(["f1"]);
		expect(context?.inheritedAuth).toEqual(basic);
		const orphan = requestContext(collection([request("r2", "gone")]), "r2");
		expect(orphan?.folderPath).toEqual([]);
		expect(orphan?.authSource.kind).toBe("collection");
	});

	it("stops at a parent that is a request", () => {
		const detail = collection([request("r0", null), request("r1", "r0")]);
		expect(requestContext(detail, "r1")?.folderPath).toEqual([]);
	});

	it("stops at a cycle instead of looping", () => {
		const detail = collection([
			folder("f1", "f2", basic),
			folder("f2", "f1"),
			request("r1", "f1"),
		]);
		const context = requestContext(detail, "r1");
		expect(context?.folderPath.map((f) => f.id)).toEqual(["f2", "f1"]);
		expect(context?.inheritedAuth).toEqual(basic);
	});

	it("is null for an unknown id or a folder", () => {
		const detail = collection([folder("f1", null), request("r1", "f1")]);
		expect(requestContext(detail, "nope")).toBeNull();
		expect(requestContext(detail, "f1")).toBeNull();
	});
});
