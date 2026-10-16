import { describe, expect, it } from "vitest";
import {
	collectionNodePath,
	openElementState,
	readOpenElement,
} from "./open-element-state";

describe("element navigation state", () => {
	it("keeps a node only for a collection, ids checked", () => {
		expect(
			readOpenElement(
				openElementState({ type: "collection", id: "c1", nodeId: "f1" }),
			),
		).toEqual({ type: "collection", id: "c1", nodeId: "f1" });
		expect(
			openElementState({ type: "environment", id: "e1", nodeId: "f1" }),
		).toEqual({ openElement: { type: "environment", id: "e1" } });
		expect(
			readOpenElement({
				openElement: { type: "collection", id: "c1", nodeId: "a b" },
			}),
		).toBeNull();
		expect(
			readOpenElement({ openElement: { type: "folder", id: "f1" } }),
		).toBeNull();
		expect(readOpenElement(null)).toBeNull();
	});

	it("keeps a pull request and its comment for a collection", () => {
		const state = openElementState({
			type: "collection",
			id: "c1",
			pullRequestId: "p1",
			commentId: "m1",
		});
		expect(readOpenElement(state)).toEqual({
			type: "collection",
			id: "c1",
			pullRequestId: "p1",
			commentId: "m1",
		});
		expect(
			readOpenElement({
				openElement: { type: "collection", id: "c1", pullRequestId: "../x" },
			}),
		).toBeNull();
	});

	it("builds a node link on the collection's element path", () => {
		expect(collectionNodePath("c1", "r1")).toBe(
			"/elements/collection/c1?node=r1",
		);
	});
});
