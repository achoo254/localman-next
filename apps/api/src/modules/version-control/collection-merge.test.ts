import type { CollectionNode } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { wholeTree } from "./collection-merge.js";

const folder = (id: string, parentId: string | null): CollectionNode =>
	({ id, kind: "folder", parentId, order: "a0", name: id }) as CollectionNode;
const request = (id: string, parentId: string | null): CollectionNode =>
	({ id, kind: "request", parentId, order: "a0", name: id }) as CollectionNode;
const example = (id: string, parentId: string): CollectionNode =>
	({ id, kind: "example", parentId, order: "a0", name: id }) as CollectionNode;

const parents = (nodes: Record<string, CollectionNode>) =>
	Object.fromEntries(
		Object.entries(nodes).map(([id, node]) => [id, node.parentId]),
	);

describe("the merged tree", () => {
	it("moves a node whose folder is gone to the top", () => {
		expect(parents(wholeTree({ r1: request("r1", "gone") }))).toEqual({
			r1: null,
		});
	});

	it("drops an example whose request is gone", () => {
		expect(wholeTree({ e1: example("e1", "gone") })).toEqual({});
	});

	it("breaks a loop made by moves on both sides", () => {
		const out = parents(
			wholeTree({ a: folder("a", "b"), b: folder("b", "a") }),
		);
		expect(Object.values(out)).toContain(null);
	});

	it("leaves a sound tree alone", () => {
		const nodes = {
			f: folder("f", null),
			r: request("r", "f"),
			e: example("e", "r"),
		};
		expect(wholeTree(nodes)).toEqual(nodes);
	});
});
