import {
	HISTORY_MAX_ENTRIES,
	HISTORY_TTL_DAYS,
	emptyRequestBody,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { HistoryModel } from "./history-model.js";
import {
	ALICE,
	BOB,
	as,
	draftWithSecretVar,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

const response = { status: 200, ms: 42.5, size: 1234, route: "proxy" };

async function record(sub: string, body: object = {}): Promise<string> {
	const res = await as(sub).send("post", "/client/history", {
		draft: draftWithSecretVar(),
		response,
		...body,
	});
	expect(res.status).toBe(201);
	return res.body.id;
}

describe("client history", () => {
	it("records a request as written and lists and gets it", async () => {
		const id = await record(ALICE);
		const list = await as(ALICE).get("/client/history");
		expect(list.status).toBe(200);
		expect(list.body).toMatchObject({
			items: [
				{
					id,
					method: "GET",
					url: "https://api.example.com/users?key={{token}}",
					response: { ...response, finalUrl: null },
					bodyOmitted: false,
				},
			],
			nextCursor: null,
		});
		const entry = await as(ALICE).get(`/client/history/${id}`);
		expect(entry.status).toBe(200);
		expect(entry.body.draft).toEqual(draftWithSecretVar());
	});

	it("keeps {{var}} placeholders and never the response or a secret query", async () => {
		await record(ALICE, {
			response: {
				...response,
				finalUrl: "https://user:pw@api.example.com/users?key=s3cr3t#frag",
				headers: [{ name: "set-cookie", value: "sid=s3cr3t" }],
				body: "s3cr3t payload",
			},
		});
		const stored = await HistoryModel.collection.findOne({ userSub: ALICE });
		const raw = JSON.stringify(stored);
		expect(raw).toContain('"token":"{{token}}"');
		expect(raw).not.toContain("s3cr3t");
		expect(raw).not.toContain("pw@");
		expect(stored?.response).toEqual({
			...response,
			finalUrl: "https://api.example.com/users",
		});
	});

	it("pages with a cursor, newest first", async () => {
		const ids = [await record(ALICE), await record(ALICE), await record(ALICE)];
		const first = await as(ALICE).get("/client/history?limit=2");
		expect(first.body.items.map((i: { id: string }) => i.id)).toEqual([
			ids[2],
			ids[1],
		]);
		const next = await as(ALICE).get(
			`/client/history?limit=2&cursor=${first.body.nextCursor}`,
		);
		expect(next.body).toMatchObject({
			items: [{ id: ids[0] }],
			nextCursor: null,
		});
	});

	it(`keeps the newest ${HISTORY_MAX_ENTRIES} entries per user`, async () => {
		const seeded = await HistoryModel.insertMany(
			Array.from({ length: HISTORY_MAX_ENTRIES }, () => ({
				userSub: ALICE,
				draft: draftWithSecretVar(),
				response,
			})),
		);
		await record(BOB);
		const newest = await record(ALICE);
		expect(await HistoryModel.countDocuments({ userSub: ALICE })).toBe(
			HISTORY_MAX_ENTRIES,
		);
		expect(await HistoryModel.exists({ _id: seeded[0]?._id })).toBeNull();
		expect(await HistoryModel.exists({ _id: seeded[1]?._id })).not.toBeNull();
		expect(await HistoryModel.exists({ _id: newest })).not.toBeNull();
		expect(await HistoryModel.countDocuments({ userSub: BOB })).toBe(1);
	});

	it(`expires entries after ${HISTORY_TTL_DAYS} days through a TTL index`, async () => {
		const indexes = await HistoryModel.collection.indexes();
		expect(indexes).toContainEqual(
			expect.objectContaining({
				key: { createdAt: 1 },
				expireAfterSeconds: HISTORY_TTL_DAYS * 24 * 60 * 60,
			}),
		);
	});

	it("drops the raw body of a large request and refuses an oversized one", async () => {
		const big = draftWithSecretVar({
			body: { ...emptyRequestBody(), type: "raw", raw: "x".repeat(300_000) },
		});
		const res = await as(ALICE).send("post", "/client/history", {
			draft: big,
			response,
		});
		expect(res.status).toBe(201);
		expect(res.body.bodyOmitted).toBe(true);
		const entry = await as(ALICE).get(`/client/history/${res.body.id}`);
		expect(entry.body.draft.body).toMatchObject({ type: "raw", raw: "" });

		const huge = draftWithSecretVar({
			body: { ...emptyRequestBody(), type: "raw", raw: "x".repeat(2_000_000) },
		});
		const refused = await as(ALICE).send("post", "/client/history", {
			draft: huge,
			response,
		});
		expect(refused.status).toBe(413);
		expect(refused.body.error.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("rejects an invalid response summary", async () => {
		const res = await as(ALICE).send("post", "/client/history", {
			draft: draftWithSecretVar(),
			response: { ...response, status: 42, route: "carrier-pigeon" },
		});
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("hides one user's history from another", async () => {
		const id = await record(ALICE);
		expect((await as(BOB).get("/client/history")).body.items).toEqual([]);
		expect((await as(BOB).get(`/client/history/${id}`)).status).toBe(404);
		const del = await as(BOB).send("delete", `/client/history/${id}`);
		expect(del.status).toBe(404);
		const cleared = await as(BOB).send("delete", "/client/history");
		expect(cleared.body).toMatchObject({ entryCount: 0 });
		expect((await as(ALICE).get(`/client/history/${id}`)).status).toBe(200);
	});

	it("deletes one entry, previewing it with dryRun first", async () => {
		const id = await record(ALICE);
		const preview = await as(ALICE).send(
			"delete",
			`/client/history/${id}?dryRun=true`,
		);
		expect(preview.body).toEqual({ id, deleted: false, dryRun: true });
		expect(await HistoryModel.exists({ _id: id })).not.toBeNull();
		const done = await as(ALICE).send("delete", `/client/history/${id}`);
		expect(done.body).toEqual({ id, deleted: true, dryRun: false });
		expect(await HistoryModel.exists({ _id: id })).toBeNull();
	});

	it("clears the whole history, counting it with dryRun first", async () => {
		await record(ALICE);
		await record(ALICE);
		await record(BOB);
		const preview = await as(ALICE).send(
			"delete",
			"/client/history?dryRun=true",
		);
		expect(preview.body).toEqual({
			entryCount: 2,
			deleted: false,
			dryRun: true,
		});
		const done = await as(ALICE).send("delete", "/client/history");
		expect(done.body).toEqual({ entryCount: 2, deleted: true, dryRun: false });
		expect(await HistoryModel.countDocuments({ userSub: ALICE })).toBe(0);
		expect(await HistoryModel.countDocuments({ userSub: BOB })).toBe(1);
	});
});
