import { describe, expect, it } from "vitest";
import {
	ALICE,
	as,
	draftWithSecretVar,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

const source = { collectionId: "c".repeat(24), nodeId: "d".repeat(24) };
const save = (body: object = {}) =>
	as(ALICE).send("put", "/client/drafts/tab-a", {
		draft: draftWithSecretVar(),
		...body,
	});

describe("draft tab source", () => {
	it("binds a tab to a collection request, keeps it, and unbinds on null", async () => {
		const loose = await save();
		expect(loose.status).toBe(200);
		expect(loose.body).not.toHaveProperty("source");
		expect((await save({ source })).body.source).toEqual(source);
		expect((await save()).body.source).toEqual(source);
		const listed = await as(ALICE).get("/client/drafts");
		expect(listed.body.items[0].source).toEqual(source);
		expect((await save({ source: null })).body).not.toHaveProperty("source");
	});

	it("rejects a malformed source", async () => {
		const res = await save({ source: { collectionId: "" } });
		expect(res.status).toBe(400);
	});
});
