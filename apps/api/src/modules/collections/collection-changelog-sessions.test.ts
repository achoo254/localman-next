import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC } from "../access/testing/access-fixture.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import {
	emptyCollection,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const START = Date.parse("2026-01-05T09:00:00Z");
const MINUTE = 60_000;

interface Seed {
	readonly author: string;
	/** Minutes after `START`. */
	readonly minute: number;
}

/** Replaces the changelog of `id` with renames at the given times. */
async function seed(id: string, changes: readonly Seed[]): Promise<void> {
	const collectionId = new Types.ObjectId(id);
	await CollectionRevisionModel.deleteMany({ collectionId });
	await CollectionRevisionModel.insertMany(
		changes.map((change, index) => ({
			collectionId,
			seq: index + 1,
			authorId: change.author,
			at: new Date(START + change.minute * MINUTE),
			entity: "collection",
			entityId: id,
			entityKind: "collection",
			entityName: `Step ${index + 1}`,
			action: "update",
			fields: ["name"],
			bytes: 0,
		})),
	);
}

interface Page {
	sessions: { authorId: string; changes: { entityName: string }[] }[];
	nextBefore: string | null;
}

async function pageOf(id: string, before?: string): Promise<Page> {
	const query = before === undefined ? "" : `?before=${before}`;
	const res = await as(VIC).get(`/collections/${id}/changelog${query}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body as Page;
}

/** Step numbers of each session, newest first. */
const stepsOf = (page: Page): number[][] =>
	page.sessions.map((session) =>
		session.changes.map((change) => Number(change.entityName.slice(5))),
	);

describe("changelog sessions", () => {
	it("splits one author's changes more than 5 minutes apart", async () => {
		const id = await emptyCollection();
		await seed(id, [
			{ author: EVE, minute: 0 },
			{ author: EVE, minute: 1 },
			{ author: EVE, minute: 8 },
			{ author: EVE, minute: 9 },
		]);
		const page = await pageOf(id);
		expect(stepsOf(page)).toEqual([
			[4, 3],
			[2, 1],
		]);
		expect(page.nextBefore).toBeNull();
	});

	it("closes a session 5 minutes after its first change", async () => {
		const id = await emptyCollection();
		// Every gap is 3 minutes: a chain of gaps would make one session.
		const minutes = [0, 3, 6, 9, 12];
		await seed(
			id,
			minutes.map((minute) => ({ author: EVE, minute })),
		);
		expect(stepsOf(await pageOf(id))).toEqual([[5], [4, 3], [2, 1]]);
	});

	it("starts a session when another author edits in between", async () => {
		const id = await emptyCollection();
		await seed(id, [
			{ author: EVE, minute: 0 },
			{ author: ADA, minute: 1 },
			{ author: EVE, minute: 2 },
		]);
		const page = await pageOf(id);
		expect(stepsOf(page)).toEqual([[3], [2], [1]]);
		expect(page.sessions.map((s) => s.authorId)).toEqual([EVE, ADA, EVE]);
	});

	it("never cuts a session at a page boundary", async () => {
		const id = await emptyCollection();
		// 150 changes a minute apart: sessions of 6 (minutes 0 to 5 of each).
		await seed(
			id,
			Array.from({ length: 150 }, (_, minute) => ({ author: EVE, minute })),
		);
		const first = await pageOf(id);
		// 100 changes reach step 51, inside the session of steps 49 to 54.
		expect(first.nextBefore).toBe("49");
		const second = await pageOf(id, first.nextBefore ?? "");
		expect(second.nextBefore).toBeNull();
		const sessions = [...stepsOf(first), ...stepsOf(second)];
		expect(sessions).toHaveLength(25);
		sessions.forEach((steps, index) => {
			const top = 150 - index * 6;
			expect(steps).toEqual([top, top - 1, top - 2, top - 3, top - 4, top - 5]);
		});
	});
});
