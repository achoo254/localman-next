import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC, patchAs } from "../access/testing/access-fixture.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";
import { SHOP_TREE_FOR_TESTS } from "./testing/shop-tree.js";

useCollectionTestDb();

describe("collection tags and status", () => {
	it("normalizes tags and sets, changes and clears the status", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Tagged" });
		const path = `/collections/${id}`;
		const tagged = await patchAs(EVE, path, {
			tags: ["Payments", "payments", " v2 "],
			status: { kind: "custom", name: "Beta", emoji: "🧪" },
		});
		expect(tagged.status, JSON.stringify(tagged.body)).toBe(200);
		expect(tagged.body).toMatchObject({
			tags: ["payments", "v2"],
			status: { kind: "custom", name: "Beta", emoji: "🧪" },
		});
		const preset = await patchAs(EVE, path, {
			status: { kind: "preset", preset: "deprecated" },
		});
		expect(preset.body.status).toEqual({
			kind: "preset",
			preset: "deprecated",
		});
		expect((await patchAs(EVE, path, { status: null })).body.status).toBeNull();
		const listed = await as(VIC).get(`/workspaces/${ws}/collections`);
		expect(listed.body.items[0]).toMatchObject({
			tags: ["payments", "v2"],
			status: null,
		});
	});

	it("rejects tags and statuses that break the rules", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Strict" });
		const path = `/collections/${id}`;
		const bad = [
			{ tags: ["-edge"] },
			{ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
			{ status: { kind: "custom", name: "B", emoji: "🧪" } },
			{ status: { kind: "custom", name: "Beta", emoji: "🧪🧪" } },
			{ status: { kind: "preset", preset: "gold" } },
		];
		for (const body of bad) {
			const res = await patchAs(EVE, path, body);
			expect(res.status, JSON.stringify(body)).toBe(400);
		}
		expect((await patchAs(VIC, path, { tags: ["ok"] })).status).toBe(403);
	});

	it("keeps tags and status from an import, and names creator and editor", async () => {
		const ws = (await teamOfThree()).toHexString();
		const created = await createAs(ADA, ws, { tree: SHOP_TREE_FOR_TESTS });
		expect(created).toMatchObject({
			tags: ["shop"],
			status: { kind: "custom", name: "Beta", emoji: "🧪" },
			createdBy: ADA,
			createdByName: "Ada",
			updatedByName: "Ada",
		});
		const edited = await patchAs(EVE, `/collections/${created.id}`, {
			description: "x",
		});
		expect(edited.body).toMatchObject({ updatedBy: EVE, updatedByName: "Eve" });
		const example = created.nodes.find((node) => node.kind === "example");
		expect(example).toMatchObject({ name: "200", response: { status: 200 } });
	});
});
