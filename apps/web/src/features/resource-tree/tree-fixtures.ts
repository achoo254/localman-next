import type { TreeItem } from "./tree-layout";

/** users → posts → comments, and likes at the root (spec sample tree). */
export const SAMPLE_TREE: readonly TreeItem[] = Object.freeze([
	{ id: "users", parentId: null, name: "users" },
	{ id: "posts", parentId: "users", name: "posts" },
	{ id: "comments", parentId: "posts", name: "comments" },
	{ id: "likes", parentId: null, name: "likes" },
]);
