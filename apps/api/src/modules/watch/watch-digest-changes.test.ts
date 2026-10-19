import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	notificationsOf,
	patchAs,
} from "../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	folder,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { digestWatches } from "./watch-digest.js";

useCollectionTestDb();

const logger = createLogger("silent");
const watch = (sub: string, id: string) =>
	as(sub).send("put", `/collections/${id}/watch`, { watching: true });

async function teamCollection() {
	const ws = await teamOfThree();
	const { id } = await createAs(ADA, ws.toHexString(), { name: "Orders API" });
	const req = await addNode(ADA, id, requestNode("List"));
	return { id, nodeId: req.id };
}

describe("watch digest covers every kind of collection change", () => {
	it("tells the watcher about a collection variable change", async () => {
		const { id } = await teamCollection();
		await watch(VIC, id);
		const res = await patchAs(ADA, `/collections/${id}`, {
			variables: [{ key: "baseUrl", value: "https://api.test", secret: false }],
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		expect(await digestWatches(logger)).toBe(1);
		const [told] = await notificationsOf(VIC);
		expect(told?.type).toBe("collection.changed");
		expect(told?.params).toEqual({
			collection: "Orders API",
			changes: 1,
			authors: 1,
			author: "Ada",
		});
	});

	it("tells the watcher about a collection script change", async () => {
		const { id } = await teamCollection();
		await watch(VIC, id);
		const res = await patchAs(EVE, `/collections/${id}`, {
			scripts: { pre: "console.log('before');", post: "" },
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		expect(await digestWatches(logger)).toBe(1);
		const [told] = await notificationsOf(VIC);
		expect(told?.type).toBe("collection.changed");
		expect(told?.params).toMatchObject({
			changes: 1,
			authors: 1,
			author: "Eve",
		});
	});

	it("tells the watcher about a folder change, not only a request rename", async () => {
		const ws = await teamOfThree();
		const { id } = await createAs(ADA, ws.toHexString(), {
			name: "Orders API",
		});
		const dir = await addNode(ADA, id, folder("Orders"));
		await watch(VIC, id);
		const res = await patchAs(ADA, `/collections/${id}/nodes/${dir.id}`, {
			name: "Purchases",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);

		expect(await digestWatches(logger)).toBe(1);
		const [told] = await notificationsOf(VIC);
		expect(told?.params).toMatchObject({
			changes: 1,
			authors: 1,
			author: "Ada",
		});
	});
});
