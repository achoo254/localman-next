import { afterEach, describe, expect, it, vi } from "vitest";
import { type FetchCall, mockFetch } from "../../test/mock-fetch";
import type { BulkPlan } from "./bulk-plan";
import {
	BULK_NODES_MAX,
	BULK_TRASH_MAX,
	BulkStopped,
	chunk,
	previewBulk,
	runBulk,
} from "./bulk-run";
import { summary } from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const NODES = "/api/v1/collections/c1/nodes/bulk-delete";
const TRASH = "/api/v1/workspaces/w-team/collections/bulk-trash";
const ids = (prefix: string, n: number) =>
	Array.from({ length: n }, (_, i) => `${prefix}${i}`);

function plan(collections: number, nodes: number): BulkPlan {
	return {
		collections: ids("c-", collections).map((id) => summary(id)),
		nodes: new Map(nodes ? [["c1", ids("n-", nodes)]] : []),
		total: collections + nodes,
	};
}

const sizes = (calls: FetchCall[], path: string, dryRun: boolean) =>
	calls
		.filter((c) => c.path === path && c.query.has("dryRun") === dryRun)
		.map((c) => {
			const body = c.body as { nodeIds?: unknown[]; collectionIds?: unknown[] };
			return (body.nodeIds ?? body.collectionIds ?? []).length;
		});

const trashReply = (call: FetchCall) => {
	const body = call.body as { collectionIds: string[] };
	return {
		body: {
			collections: body.collectionIds.map((id) => ({
				collectionId: id,
				requests: 1,
			})),
		},
	};
};

describe("bulk deletion in chunks", () => {
	it("splits 201 rows into calls the API accepts", async () => {
		const { calls } = mockFetch({
			// Only the second dry run finds something too large to keep.
			[`POST ${NODES}`]: ({ body }) => ({
				body: {
					requests: 1,
					irreversible: (body as { nodeIds: string[] }).nodeIds.length === 1,
				},
			}),
			[`POST ${TRASH}`]: trashReply,
		});
		const picked = plan(201, 201);
		await expect(previewBulk("w-team", picked)).resolves.toEqual({
			requests: 201,
			irreversible: true,
		});
		expect(sizes(calls, TRASH, true)).toEqual([BULK_TRASH_MAX, 100, 1]);
		expect(sizes(calls, NODES, true)).toEqual([BULK_NODES_MAX, 1]);
		await expect(runBulk("w-team", picked, false)).resolves.toBe(402);
		expect(sizes(calls, TRASH, false)).toEqual([100, 100, 1]);
		expect(sizes(calls, NODES, false)).toEqual([200, 1]);
	});

	it("stops at the failing chunk and counts what went before it", async () => {
		let real = 0;
		mockFetch({
			[`POST ${NODES}`]: () =>
				++real === 2
					? {
							status: 404,
							body: { error: { code: "NODE_NOT_FOUND", message: "x" } },
						}
					: { body: { requests: 0 } },
		});
		const stopped = await runBulk("w-team", plan(0, 201), false).catch(
			(error: unknown) => error,
		);
		expect(stopped).toBeInstanceOf(BulkStopped);
		expect(stopped instanceof BulkStopped && stopped.done).toBe(200);
	});

	it("chunks keep order and the last one takes the rest", () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 2)).toEqual([]);
	});
});
