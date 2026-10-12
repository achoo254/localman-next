import type { CollectionDetail } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { mockFetch } from "../../test/mock-fetch";
import { createTestQueryClient } from "../../test/render-app";
import { example } from "./collections-fixtures";
import { detail, folder, request, summary } from "./collections-test-utils";
import { buildTreeRows } from "./tree-rows";
import { type DetailState, collectionKey } from "./use-collections";
import { useMoveNode } from "./use-node-mutations";
import { useTreeDnd } from "./use-tree-dnd";

afterEach(() => vi.unstubAllGlobals());

const SHOP = detail("c1", [
	folder("f1", null, "a0", "Users"),
	request("r1", "f1", "a0", "List users"),
	folder("f2", "f1", "a1", "Admin"),
	request("top", null, "a1", "Health"),
]);
const MOVE_PATH = "/api/v1/collections/c1/nodes";

/** The tree's drag and drop wired to the real move mutation. */
function renderDnd(cached: CollectionDetail) {
	const client = createTestQueryClient();
	client.setQueryData(collectionKey("c1"), cached);
	const details = new Map<string, DetailState>([
		["c1", { status: "ready", detail: cached }],
	]);
	const rows = buildTreeRows({
		collections: [summary("c1")],
		details,
		expanded: new Set(["c1", "f1", "f2", "r1"]),
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			<ToastProvider>{children}</ToastProvider>
		</QueryClientProvider>
	);
	const hook = renderHook(
		() => {
			const move = useMoveNode();
			return useTreeDnd({ rows, details, onMove: move.mutate });
		},
		{ wrapper },
	);
	return { ...hook, client };
}

describe("tree drag and drop", () => {
	it("moves a request into a folder with the neighbours' order keys", async () => {
		const { calls } = mockFetch({
			[`POST ${MOVE_PATH}/top/move`]: {
				body: { ...request("top", "f1", "a0V", "Health") },
			},
			"GET /api/v1/collections/c1": { body: SHOP },
		});
		const { result, client } = renderDnd(SHOP);
		let moved = false;
		act(() => {
			moved = result.current.drop("top", "r1", "after");
		});
		expect(moved).toBe(true);
		await waitFor(() =>
			expect(calls.some((c) => c.method === "POST")).toBe(true),
		);
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			parentId: "f1",
			beforeOrder: "a0",
			afterOrder: "a1",
		});
		// The tree shows the drop before the API answers.
		const cached = client.getQueryData<CollectionDetail>(collectionKey("c1"));
		expect(cached?.nodes.find((n) => n.id === "top")?.parentId).toBe("f1");
	});

	it("drops on the collection row at the end of the top level", async () => {
		const { calls } = mockFetch({
			[`POST ${MOVE_PATH}/r1/move`]: { body: request("r1", null, "a2") },
			"GET /api/v1/collections/c1": { body: SHOP },
		});
		const { result } = renderDnd(SHOP);
		act(() => {
			result.current.drop("r1", "c1", "inside");
		});
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				parentId: null,
				beforeOrder: "a1",
				afterOrder: null,
			}),
		);
	});

	it("reorders the examples of one request", async () => {
		const withExamples = {
			...SHOP,
			nodes: [
				...SHOP.nodes,
				example("e1", "r1", "a0", "Found"),
				example("e2", "r1", "a1", "Missing"),
			],
		};
		const { calls } = mockFetch({
			[`POST ${MOVE_PATH}/e2/move`]: {
				body: example("e2", "r1", "Zz", "Missing"),
			},
			"GET /api/v1/collections/c1": { body: withExamples },
		});
		const { result } = renderDnd(withExamples);
		let moved = true;
		act(() => {
			moved = result.current.drop("e2", "top", "before");
		});
		expect(moved).toBe(false);
		act(() => {
			moved = result.current.drop("e2", "e1", "before");
		});
		expect(moved).toBe(true);
		await waitFor(() =>
			expect(calls.find((c) => c.method === "POST")?.body).toEqual({
				parentId: "r1",
				beforeOrder: null,
				afterOrder: "a0",
			}),
		);
	});

	it("never sends a folder into its own subtree", () => {
		const { calls } = mockFetch({});
		const { result } = renderDnd(SHOP);
		let moved = true;
		act(() => {
			moved = result.current.drop("f1", "f2", "inside");
		});
		expect(moved).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("puts the tree back when the API refuses the move", async () => {
		mockFetch({
			[`POST ${MOVE_PATH}/top/move`]: {
				status: 400,
				body: { error: { code: "MOVE_CYCLE", message: "cycle" } },
			},
			"GET /api/v1/collections/c1": { body: SHOP },
		});
		const { result, client } = renderDnd(SHOP);
		act(() => {
			result.current.drop("top", "f2", "inside");
		});
		expect(
			await screen.findByText("A folder can't go inside itself."),
		).toBeVisible();
		const cached = client.getQueryData<CollectionDetail>(collectionKey("c1"));
		expect(cached?.nodes.find((n) => n.id === "top")?.parentId).toBeNull();
	});
});
