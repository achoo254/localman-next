import { DRAFT_MAX_TABS, emptyRequestBody } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { DraftModel } from "./draft-model.js";
import { DRAFT_MAX_BYTES } from "./draft-size.js";
import {
	ALICE,
	BOB,
	as,
	draftWithSecretVar,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

const save = (sub: string, tabId: string, body: object = {}) =>
	as(sub).send("put", `/client/drafts/${tabId}`, {
		draft: draftWithSecretVar(),
		...body,
	});

const tabIdsOf = (body: { items: { tabId: string }[] }) =>
	body.items.map((item) => item.tabId);

describe("client drafts", () => {
	it("saves tabs in order and replaces a tab's draft on save", async () => {
		expect((await save(ALICE, "tab-a")).body).toMatchObject({
			tabId: "tab-a",
			order: 0,
		});
		expect((await save(ALICE, "tab-b")).body.order).toBe(1);
		const renamed = draftWithSecretVar({ name: "Renamed" });
		const replaced = await save(ALICE, "tab-a", { draft: renamed });
		expect(replaced.status).toBe(200);
		expect(replaced.body).toMatchObject({ order: 0, draft: renamed });

		const list = await as(ALICE).get("/client/drafts");
		expect(tabIdsOf(list.body)).toEqual(["tab-a", "tab-b"]);
		expect(list.body.items[0].draft.auth).toEqual({
			type: "bearer",
			token: "{{token}}",
		});
	});

	it("reorders tabs", async () => {
		await save(ALICE, "tab-a");
		await save(ALICE, "tab-b");
		await save(ALICE, "tab-c");
		const res = await as(ALICE).send("put", "/client/draft-order", {
			tabIds: ["tab-c", "tab-a", "tab-b", "tab-unknown"],
		});
		expect(res.status).toBe(200);
		expect(tabIdsOf(res.body)).toEqual(["tab-c", "tab-a", "tab-b"]);
		expect((await save(ALICE, "tab-d")).body.order).toBe(3);
	});

	it(`refuses a draft above ${DRAFT_MAX_BYTES} bytes`, async () => {
		const raw = "x".repeat(DRAFT_MAX_BYTES);
		const res = await save(ALICE, "tab-a", {
			draft: draftWithSecretVar({
				body: { ...emptyRequestBody(), type: "raw", raw },
			}),
		});
		expect(res.status).toBe(413);
		expect(res.body.error).toMatchObject({
			code: "DRAFT_TOO_LARGE",
			details: { maxBytes: DRAFT_MAX_BYTES },
		});
		expect(await DraftModel.countDocuments()).toBe(0);
	});

	it(`keeps at most ${DRAFT_MAX_TABS} tabs`, async () => {
		await DraftModel.insertMany(
			Array.from({ length: DRAFT_MAX_TABS }, (_, order) => ({
				userSub: ALICE,
				tabId: `tab-${order}`,
				order,
				draft: draftWithSecretVar(),
			})),
		);
		const refused = await save(ALICE, "tab-new");
		expect(refused.status).toBe(409);
		expect(refused.body.error).toMatchObject({
			code: "DRAFT_LIMIT_REACHED",
			details: { max: DRAFT_MAX_TABS },
		});
		expect((await save(ALICE, "tab-0")).status).toBe(200);
		expect((await save(BOB, "tab-new")).status).toBe(200);
	});

	it("deletes a closed tab's draft, closing an unsaved tab too", async () => {
		await save(ALICE, "tab-a");
		const res = await as(ALICE).send("delete", "/client/drafts/tab-a");
		expect(res.body).toEqual({ tabId: "tab-a", deleted: true });
		const again = await as(ALICE).send("delete", "/client/drafts/tab-a");
		expect(again.body).toEqual({ tabId: "tab-a", deleted: false });
	});

	it("keeps each user's tabs apart, even with the same tab id", async () => {
		await save(ALICE, "tab-a");
		expect((await as(BOB).get("/client/drafts")).body.items).toEqual([]);
		const bobDraft = draftWithSecretVar({ name: "Bob's" });
		await save(BOB, "tab-a", { draft: bobDraft });
		await as(BOB).send("put", "/client/draft-order", {
			tabIds: ["x", "tab-a"],
		});
		await as(BOB).send("delete", "/client/drafts/tab-a");
		const alice = await as(ALICE).get("/client/drafts");
		expect(alice.body.items).toMatchObject([
			{ tabId: "tab-a", order: 0, draft: draftWithSecretVar() },
		]);
	});

	it("rejects a malformed tab id", async () => {
		const res = await save(ALICE, "bad%20tab");
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});
});
