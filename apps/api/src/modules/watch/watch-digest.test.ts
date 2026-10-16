import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	notificationsOf,
	patchAs,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
import {
	addNode,
	createAs,
	draftOf,
	requestNode,
	teamOfThree,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { digestWatches } from "./watch-digest.js";

useCollectionTestDb();

const logger = createLogger("silent");
const watch = (sub: string, id: string, watching = true) =>
	as(sub).send("put", `/collections/${id}/watch`, { watching });

async function teamCollection() {
	const ws = await teamOfThree();
	const { id } = await createAs(ADA, ws.toHexString(), { name: "Orders API" });
	const req = await addNode(ADA, id, requestNode("List"));
	return { ws, id, nodeId: req.id };
}

const rename = (sub: string, id: string, nodeId: string, name: string) =>
	patchAs(sub, `/collections/${id}/nodes/${nodeId}`, { draft: draftOf(name) });

describe("watching a collection", () => {
	it("is not offered in a personal workspace", async () => {
		const { id } = await createAs(
			ADA,
			(await personalWorkspace(ADA)).toHexString(),
		);
		const view = await as(ADA).get(`/collections/${id}/watch`);
		expect(view.body).toEqual({
			collectionId: id,
			watching: false,
			available: false,
		});
		const res = await watch(ADA, id);
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("WATCH_UNAVAILABLE");
	});

	it("sums up others' changes once, from when the watch started", async () => {
		const { id, nodeId } = await teamCollection();
		expect((await watch(VIC, id)).body.watching).toBe(true);
		expect(await digestWatches(logger)).toBe(0);
		await rename(ADA, id, nodeId, "One");
		await rename(EVE, id, nodeId, "Two");
		await rename(EVE, id, nodeId, "Three");
		expect(await digestWatches(logger)).toBe(1);
		const [told] = await notificationsOf(VIC);
		expect(told?.type).toBe("collection.changed");
		expect(told?.params).toEqual({
			collection: "Orders API",
			changes: 3,
			authors: 2,
			author: null,
		});
		expect(told?.link).toBe(`/elements/collection/${id}`);
		expect(await digestWatches(logger)).toBe(0);
	});

	it("never reports the watcher's own changes", async () => {
		const { id, nodeId } = await teamCollection();
		await watch(EVE, id);
		await rename(EVE, id, nodeId, "Mine");
		expect(await digestWatches(logger)).toBe(0);
		await rename(ADA, id, nodeId, "Ada's");
		expect(await digestWatches(logger)).toBe(1);
		const [told] = await notificationsOf(EVE);
		expect(told?.params).toMatchObject({
			changes: 1,
			authors: 1,
			author: "Ada",
		});
	});

	it("stops after unwatching, and drops the watch of someone who left", async () => {
		const { ws, id, nodeId } = await teamCollection();
		await watch(EVE, id);
		await watch(VIC, id);
		await watch(EVE, id, false);
		await WorkspaceMemberModel.deleteOne({ workspaceId: ws, userId: VIC });
		await rename(ADA, id, nodeId, "Changed");
		expect(await digestWatches(logger)).toBe(0);
		expect(await notificationsOf(EVE)).toEqual([]);
		expect(await notificationsOf(VIC)).toEqual([]);
	});
});
