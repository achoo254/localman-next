import { describe, expect, it } from "vitest";
import { SHOP_TREE } from "../export/export-test-fixtures.js";
import type {
	CollectionTree,
	ImportedItem,
} from "../import/imported-collection.js";
import { createRequestDraft } from "../request-model.js";
import type { CollectionDetail } from "./collection-model.js";
import {
	compareOrder,
	orderKeyBetween,
	orderKeysBetween,
} from "./collection-order.js";
import {
	collectionTreeToNodes,
	nodesToCollectionTree,
} from "./collection-tree.js";

function counter(): () => string {
	let next = 0;
	return () => `n${++next}`;
}

function detailOf(tree: CollectionTree): CollectionDetail {
	const { root, nodes } = collectionTreeToNodes(tree, counter());
	return {
		id: "c1",
		workspaceId: "w1",
		role: "editor",
		...root,
		createdBy: "u1",
		createdAt: "2026-10-11T00:00:00.000Z",
		updatedAt: "2026-10-11T00:00:00.000Z",
		nodes,
	};
}

/** Item ids are regenerated on the way in; compare everything else. */
function withoutIds(items: readonly ImportedItem[]): unknown[] {
	return items.map((item) => {
		const { id: _id, ...rest } = item;
		return item.kind === "folder"
			? { ...rest, items: withoutIds(item.items) }
			: rest;
	});
}

describe("collection order keys", () => {
	it("puts a key between neighbours and at either end", () => {
		const [a, b] = orderKeysBetween(null, null, 2);
		if (!a || !b) throw new Error("no keys");
		expect(a < b).toBe(true);
		const mid = orderKeyBetween(a, b);
		expect(a < mid && mid < b).toBe(true);
		expect(orderKeyBetween(null, a) < a).toBe(true);
		expect(orderKeyBetween(b, null) > b).toBe(true);
	});

	it("rejects keys out of order and malformed keys", () => {
		const [a, b] = orderKeysBetween(null, null, 2);
		if (!a || !b) throw new Error("no keys");
		expect(() => orderKeyBetween(b, a)).toThrow();
		expect(() => orderKeyBetween(a, a)).toThrow();
		expect(() => orderKeyBetween("", null)).toThrow();
		expect(() => orderKeyBetween("a0 ", null)).toThrow();
		expect(() => orderKeyBetween("zzz", null)).toThrow();
	});

	it("compares by code unit, then by id", () => {
		const rows = [
			{ order: "a1", id: "z" },
			{ order: "Zz", id: "b" },
			{ order: "a1", id: "a" },
		];
		rows.sort(compareOrder);
		expect(rows.map((row) => row.id)).toEqual(["b", "a", "z"]);
	});
});

describe("collection tree conversion", () => {
	it("round-trips tree to nodes to tree", () => {
		const back = nodesToCollectionTree(detailOf(SHOP_TREE));
		expect({ ...back, items: withoutIds(back.items) }).toEqual({
			...SHOP_TREE,
			items: withoutIds(SHOP_TREE.items),
		});
	});

	it("links nodes by parent and orders siblings", () => {
		const { root, nodes } = collectionTreeToNodes(SHOP_TREE, counter());
		expect(root.name).toBe("Shop");
		const folder = nodes.find((node) => node.kind === "folder");
		if (!folder) throw new Error("no folder");
		const children = nodes.filter((node) => node.parentId === folder.id);
		expect(children.map((node) => node.name)).toEqual([
			"Get user",
			"Create user",
		]);
		const [first, second] = children;
		if (!first || !second) throw new Error("no children");
		expect(first.order < second.order).toBe(true);
		expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
	});

	it("sorts by order key, not by insertion, and drops orphans", () => {
		const draft = createRequestDraft();
		const request = (id: string, order: string, parentId: string | null) => ({
			kind: "request" as const,
			id,
			parentId,
			order,
			name: id,
			description: "",
			draft,
		});
		const detail = detailOf({ ...SHOP_TREE, items: [] });
		detail.nodes = [
			request("late", "a2", null),
			request("early", "a0", null),
			request("orphan", "a1", "missing"),
		];
		const tree = nodesToCollectionTree(detail);
		expect(tree.items.map((item) => item.id)).toEqual(["early", "late"]);
	});
});
