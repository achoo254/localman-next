import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	createAs,
	emptyCollection,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();
afterEach(() => vi.restoreAllMocks());

const START = Date.parse("2026-01-05T09:00:00Z");

interface Seed {
	readonly author: string;
	/** Seconds after `START`. */
	readonly second: number;
	/** Stored session start; absent for a revision written before marks. */
	readonly start?: number;
}

async function seed(id: string, changes: readonly Seed[]): Promise<void> {
	const collectionId = new Types.ObjectId(id);
	await CollectionRevisionModel.deleteMany({ collectionId });
	await CollectionRevisionModel.insertMany(
		changes.map((change, index) => {
			const startIndex = (change.start ?? 0) - 1;
			const mark =
				change.start === undefined
					? {}
					: {
							sessionStartSeq: change.start,
							sessionStartAt: new Date(
								START + (changes[startIndex]?.second ?? 0) * 1000,
							),
						};
			return {
				collectionId,
				seq: index + 1,
				authorId: change.author,
				at: new Date(START + change.second * 1000),
				entity: "collection",
				entityId: id,
				entityKind: "collection",
				entityName: `Step ${index + 1}`,
				action: "update",
				fields: ["name"],
				bytes: 0,
				...mark,
			};
		}),
	);
}

interface Page {
	sessions: { changes: { entityName: string }[] }[];
	nextBefore: string | null;
}

async function pageOf(id: string, before?: string): Promise<Page> {
	const query = before === undefined ? "" : `?before=${before}`;
	const res = await as(VIC).get(`/collections/${id}/changelog${query}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body as Page;
}

const sizesOf = (page: Page) => page.sessions.map((s) => s.changes.length);

describe("stored changelog sessions", () => {
	it("marks each write with the session it joins", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		await patchAs(EVE, `/collections/${id}`, { name: "Orders 2" });
		await patchAs(EVE, `/collections/${id}`, { name: "Orders 3" });
		await patchAs(ADA, `/collections/${id}`, { name: "Orders 4" });
		const rows = await CollectionRevisionModel.find(
			{ collectionId: new Types.ObjectId(id) },
			{ seq: 1, sessionStartSeq: 1 },
		)
			.sort({ seq: 1 })
			.lean<{ seq: number; sessionStartSeq: number }[]>();
		expect(rows.map((r) => [r.seq, r.sessionStartSeq])).toEqual([
			[1, 1],
			[2, 2],
			[3, 2],
			[4, 4],
		]);
	});

	it("pages a 300-change session whole, with a bounded number of reads", async () => {
		const id = await emptyCollection();
		await seed(id, [
			...Array.from({ length: 300 }, (_, i) => ({
				author: EVE,
				second: i,
				start: 1,
			})),
			...Array.from({ length: 50 }, (_, i) => ({
				author: ADA,
				second: 400 + i,
				start: 301,
			})),
		]);
		const find = vi.spyOn(CollectionRevisionModel, "find");
		const page = await pageOf(id);
		expect(sizesOf(page)).toEqual([50, 300]);
		expect(page.nextBefore).toBeNull();
		// The page itself and the rest of its oldest session.
		expect(find).toHaveBeenCalledTimes(2);
	});

	it("starts the next page right below a stored session", async () => {
		const id = await emptyCollection();
		// Sessions of 30, ten of them, by turns.
		await seed(
			id,
			Array.from({ length: 300 }, (_, i) => {
				const session = Math.floor(i / 30);
				return {
					author: session % 2 === 0 ? EVE : ADA,
					second: i,
					start: session * 30 + 1,
				};
			}),
		);
		const first = await pageOf(id);
		// 100 changes reach into the session of 181 to 210.
		expect(first.nextBefore).toBe("181");
		const second = await pageOf(id, first.nextBefore ?? "");
		const sizes = [...sizesOf(first), ...sizesOf(second)];
		expect(sizes.slice(0, 6)).toEqual([30, 30, 30, 30, 30, 30]);
	});

	it("still groups older revisions without stored sessions", async () => {
		const id = await emptyCollection();
		await seed(id, [
			...Array.from({ length: 5 }, (_, i) => ({
				author: EVE,
				second: i * 180,
			})),
			{ author: EVE, second: 2000, start: 6 },
			{ author: EVE, second: 2001, start: 6 },
		]);
		const page = await pageOf(id);
		// Stored: steps 6-7. Older ones, 3 minutes apart, from the oldest:
		// 0 and 3 min, 6 and 9 min, then 12 min alone.
		expect(sizesOf(page)).toEqual([2, 1, 2, 2]);
	});
});
