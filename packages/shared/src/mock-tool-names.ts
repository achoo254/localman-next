/**
 * Which MCP tools a project's mock exposes and what they are called:
 * `list_`, `get_`, `create_`, `update_` and `delete_<res>` per resource,
 * one per enabled REST endpoint. Shared by the Hosted Mock MCP server
 * (which adds input schemas) and the web MCP tab (which lists the tools),
 * so both always show the same names. No zod, no Faker.
 */
import type { ENDPOINT_METHODS, ENDPOINT_PATHS } from "./resource-constants.js";

export const MOCK_TOOL_ACTIONS = [
	"list",
	"get",
	"create",
	"update",
	"delete",
] as const;
export type MockToolAction = (typeof MOCK_TOOL_ACTIONS)[number];

/** The REST endpoint serving each action (PATCH shares PUT). */
export const MOCK_TOOL_ENDPOINTS: Readonly<
	Record<
		MockToolAction,
		{
			readonly method: (typeof ENDPOINT_METHODS)[number];
			readonly path: (typeof ENDPOINT_PATHS)[number];
		}
	>
> = Object.freeze({
	list: { method: "GET", path: "/:res" },
	get: { method: "GET", path: "/:res/:id" },
	create: { method: "POST", path: "/:res" },
	update: { method: "PUT", path: "/:res/:id" },
	delete: { method: "DELETE", path: "/:res/:id" },
});

/** Tool names MCP clients accept. */
export const MOCK_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const TOOL_NAME_MAX = 64;
/** Longest resource part of a name: `create_` is the longest prefix. */
const SLUG_MAX = TOOL_NAME_MAX - "create_".length;

/** What naming needs of a resource. */
export interface MockToolNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly name: string;
	readonly endpoints: readonly {
		readonly method: string;
		readonly path: string;
		readonly enabled: boolean;
	}[];
}

export interface MockToolEntry<T extends MockToolNode> {
	readonly name: string;
	readonly action: MockToolAction;
	readonly resource: T;
	/** Ancestor resources, outermost first; `[]` for a root. */
	readonly ancestors: readonly T[];
}

/**
 * Resource part of a tool name: runs of characters outside
 * `[A-Za-z0-9_-]` become `_`, case is kept (siblings `Side` and `side`
 * may coexist), and the result is cut to fit 64 characters. A name with
 * no letter or digit left becomes `resource`.
 */
export function mockToolSlug(name: string): string {
	const slug = name.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, SLUG_MAX);
	return /[A-Za-z0-9]/.test(slug) ? slug : "resource";
}

/**
 * Pre-order walk with ancestors: parents before children, siblings in
 * input order. A missing parent makes a root; nodes only a cycle reaches
 * (which writes never produce) are walked as roots afterwards.
 */
function walkTree<T extends MockToolNode>(
	nodes: readonly T[],
): { node: T; ancestors: T[] }[] {
	const ids = new Set(nodes.map((node) => node.id));
	const children = new Map<string | null, T[]>();
	for (const node of nodes) {
		const parent =
			node.parentId !== null && ids.has(node.parentId) ? node.parentId : null;
		children.set(parent, [...(children.get(parent) ?? []), node]);
	}
	const ordered: { node: T; ancestors: T[] }[] = [];
	const seen = new Set<string>();
	const visit = (node: T, ancestors: T[]): void => {
		if (seen.has(node.id)) return;
		seen.add(node.id);
		ordered.push({ node, ancestors });
		for (const child of children.get(node.id) ?? []) {
			visit(child, [...ancestors, node]);
		}
	};
	for (const root of children.get(null) ?? []) visit(root, []);
	for (const node of nodes) visit(node, []);
	return ordered;
}

function withSuffix(base: string, n: number): string {
	const suffix = `_${n}`;
	return `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
}

/**
 * A unique slug per resource id, the same for any input order. A name
 * may repeat across branches (`posts/comments`, `photos/comments`) and
 * cutting long names may make two equal. Each slug goes as is to its
 * first claimant (shallowest, then lowest id); the others get `_2`,
 * `_3`, … skipping slugs in use, so a resource literally named
 * `comments_2` keeps its name.
 */
function uniqueSlugs(
	entries: readonly { node: MockToolNode; ancestors: readonly unknown[] }[],
): Map<string, string> {
	const ordered = [...entries].sort((a, b) => {
		const byDepth = a.ancestors.length - b.ancestors.length;
		if (byDepth !== 0) return byDepth;
		// Code-unit order: the same in Node and every browser, unlike locales.
		if (a.node.id === b.node.id) return 0;
		return a.node.id < b.node.id ? -1 : 1;
	});
	const slugs = new Map<string, string>();
	const used = new Set<string>();
	for (const { node } of ordered) {
		const slug = mockToolSlug(node.name);
		if (used.has(slug)) continue;
		used.add(slug);
		slugs.set(node.id, slug);
	}
	for (const { node } of ordered) {
		if (slugs.has(node.id)) continue;
		const base = mockToolSlug(node.name);
		let n = 2;
		while (used.has(withSuffix(base, n))) n += 1;
		used.add(withSuffix(base, n));
		slugs.set(node.id, withSuffix(base, n));
	}
	return slugs;
}

/** Whether the REST endpoint of `action` is enabled (missing: disabled). */
export function isMockToolEnabled(
	node: MockToolNode,
	action: MockToolAction,
): boolean {
	const { method, path } = MOCK_TOOL_ENDPOINTS[action];
	return node.endpoints.some(
		(endpoint) =>
			endpoint.method === method &&
			endpoint.path === path &&
			endpoint.enabled === true,
	);
}

/**
 * The mock's tools in tree pre-order, then `MOCK_TOOL_ACTIONS` order,
 * one per enabled endpoint. Names are computed over every resource, so
 * disabling an endpoint never renames another resource's tools.
 */
export function mockToolEntries<T extends MockToolNode>(
	nodes: readonly T[],
): MockToolEntry<T>[] {
	const walked = walkTree(nodes);
	const slugs = uniqueSlugs(walked);
	return walked.flatMap(({ node, ancestors }) => {
		const slug = slugs.get(node.id) ?? mockToolSlug(node.name);
		return MOCK_TOOL_ACTIONS.filter((action) =>
			isMockToolEnabled(node, action),
		).map((action) => ({
			name: `${action}_${slug}`,
			action,
			resource: node,
			ancestors,
		}));
	});
}
