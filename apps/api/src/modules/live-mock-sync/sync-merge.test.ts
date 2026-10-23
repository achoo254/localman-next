import { completeEndpoints } from "@localman/shared";
import type {
	CollectionNode,
	CollectionRequestNode,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import type { CollectionState } from "../collections/revision-patch.js";
import {
	type MockNodes,
	type MockSyncResource,
	mockToCollection,
} from "./mock-to-collection-mapper.js";
import { REMOVED_KEY } from "./sync-keys.js";
import { type SyncPair, mergeMockChanges } from "./sync-merge.js";
import { DEFAULT_SYNC_NAMES } from "./sync-names.js";

const users = (
	name = "users",
	endpoints = completeEndpoints(),
): MockSyncResource => ({
	id: "u",
	name,
	parentId: null,
	schema: [{ name: "name", type: "String" }],
	endpoints,
});

const ROOT: CollectionState["root"] = {
	name: "Shop",
	description: "",
	auth: { type: "none" },
	scripts: { pre: "", post: "" },
	variables: [],
	tags: [],
	status: null,
};

/** The collection as first made from `nodes`: node ids `n<i>`, paired. */
function madeFrom(nodes: MockNodes): {
	collection: CollectionState;
	pairs: SyncPair[];
} {
	const keys = Object.keys(nodes);
	const idOf = new Map(keys.map((key, index) => [key, `n${index}`]));
	const out: Record<string, CollectionNode> = {};
	for (const node of Object.values(nodes)) {
		const id = idOf.get(node.id) ?? node.id;
		const parentId =
			node.parentId === null ? null : (idOf.get(node.parentId) ?? null);
		out[id] = { ...node, id, parentId } as CollectionNode;
	}
	return {
		collection: { root: ROOT, nodes: out },
		pairs: keys.map((k) => ({ k, n: idOf.get(k) ?? k })),
	};
}

let counter = 0;
const fresh = (): string => `new${++counter}`;

function requestOf(
	state: CollectionState,
	pairs: readonly SyncPair[],
	key: string,
): CollectionRequestNode {
	const id = pairs.find((pair) => pair.k === key)?.n ?? "";
	const node = state.nodes[id];
	if (node?.kind !== "request") throw new Error(`no request ${key}`);
	return node;
}

describe("mergeMockChanges", () => {
	const base = mockToCollection([users()], DEFAULT_SYNC_NAMES);
	const list = "mock:u:GET:collection";

	it("keeps a header the user added while the mock renames the path", () => {
		const { collection, pairs } = madeFrom(base);
		const mine = requestOf(collection, pairs, list);
		const header = { id: "h1", key: "X-Trace", value: "1", enabled: true };
		collection.nodes[mine.id] = {
			...mine,
			draft: { ...mine.draft, headers: [header] },
		};
		const mapped = mockToCollection([users("members")], DEFAULT_SYNC_NAMES);
		const out = mergeMockChanges(
			{ base, mapped, collection, pairs, names: DEFAULT_SYNC_NAMES },
			fresh,
		);
		expect(out.unresolved).toEqual([]);
		const merged = requestOf(out.target, out.pairs, list);
		expect(merged.id).toBe(mine.id);
		expect(merged.draft.url).toBe("{{baseUrl}}/members");
		expect(merged.draft.headers).toEqual([header]);
	});

	it("reports a clash on a field both changed and applies the choice", () => {
		const { collection, pairs } = madeFrom(base);
		const mine = requestOf(collection, pairs, list);
		collection.nodes[mine.id] = {
			...mine,
			draft: { ...mine.draft, url: "{{baseUrl}}/people" },
		};
		const mapped = mockToCollection([users("members")], DEFAULT_SYNC_NAMES);
		const inputs = {
			base,
			mapped,
			collection,
			pairs,
			names: DEFAULT_SYNC_NAMES,
		};
		const open = mergeMockChanges(inputs, fresh);
		const conflict = `${list}:draft.url`;
		expect(open.unresolved).toContain(conflict);
		// Until resolved the collection keeps its value.
		expect(requestOf(open.target, open.pairs, list).draft.url).toBe(
			"{{baseUrl}}/people",
		);
		const resolutions = Object.fromEntries(
			open.unresolved.map((id) => [id, "source" as const]),
		);
		const taken = mergeMockChanges({ ...inputs, resolutions }, fresh);
		expect(taken.unresolved).toEqual([]);
		expect(requestOf(taken.target, taken.pairs, list).draft.url).toBe(
			"{{baseUrl}}/members",
		);
	});

	it("moves requests of a disabled endpoint to _removed, and lets them go once deleted", () => {
		const { collection, pairs } = madeFrom(base);
		const endpoints = completeEndpoints([
			{ method: "DELETE", path: "/:res/:id", enabled: false },
		]);
		const mapped = mockToCollection(
			[users("users", endpoints)],
			DEFAULT_SYNC_NAMES,
		);
		const out = mergeMockChanges(
			{ base, mapped, collection, pairs, names: DEFAULT_SYNC_NAMES },
			fresh,
		);
		const removed = requestOf(out.target, out.pairs, "mock:u:DELETE:item");
		const folder = out.target.nodes[removed.parentId ?? ""];
		expect(folder).toMatchObject({ kind: "folder", name: "_removed" });
		expect(removed.description).toBe(DEFAULT_SYNC_NAMES.removedItem);
		// The user deletes it: the next sync does not bring it back.
		const next = { ...out.target, nodes: { ...out.target.nodes } };
		delete next.nodes[removed.id];
		delete next.nodes[folder?.id ?? ""];
		const again = mergeMockChanges(
			{
				base: out.theirs,
				mapped,
				collection: next,
				pairs: out.pairs,
				names: DEFAULT_SYNC_NAMES,
			},
			fresh,
		);
		expect(again.target.nodes[removed.id]).toBeUndefined();
		expect(Object.keys(again.theirs)).not.toContain(REMOVED_KEY);
	});

	it("adds the requests of a new resource with fresh ids", () => {
		const { collection, pairs } = madeFrom(base);
		const posts: MockSyncResource = {
			...users("posts"),
			id: "p",
			parentId: "u",
		};
		const mapped = mockToCollection([users(), posts], DEFAULT_SYNC_NAMES);
		const out = mergeMockChanges(
			{ base, mapped, collection, pairs, names: DEFAULT_SYNC_NAMES },
			fresh,
		);
		const added = requestOf(out.target, out.pairs, "mock:p:GET:collection");
		expect(added.id).toMatch(/^new\d+$/);
		expect(added.draft.url).toBe("{{baseUrl}}/users/{{userId}}/posts");
		const folder = out.target.nodes[added.parentId ?? ""];
		expect(folder?.name).toBe("posts");
		expect(out.target.nodes[folder?.parentId ?? ""]?.name).toBe("users");
	});
});
