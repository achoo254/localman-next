import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	createAs,
	restoreAs as restore,
	teamOfThree,
	trashOf,
	trashedCrud,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";
import { TRASH_RETENTION_DAYS } from "./trash-access.js";
import { purgeExpiredTrash } from "./trash-purge-job.js";

useCollectionTestDb();

describe("trash purge and workspace deletion", () => {
	it("purges collections past the retention, leaving newer and live ones", async () => {
		const { id: old } = await trashedCrud();
		const { id: recent } = await trashedCrud();
		const live = await createAs(ADA, (await teamOfThree()).toHexString());
		const day = 24 * 60 * 60 * 1000;
		await CollectionModel.updateOne(
			{ _id: old },
			{
				$set: {
					deletedAt: new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * day),
				},
			},
		);
		expect(await purgeExpiredTrash(createLogger("silent"))).toBe(1);
		const left = await CollectionModel.find({}, { _id: 1 }).lean();
		expect(left.map((row) => row._id.toHexString()).sort()).toEqual(
			[recent, live.id].sort(),
		);
		expect(
			await CollectionNodeModel.countDocuments({ collectionId: old }),
		).toBe(0);
		expect(
			await CollectionNodeModel.countDocuments({ collectionId: recent }),
		).toBe(6);
	});

	it("trashes a deleted workspace's collections for its Admins and Editors of then", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws, { template: "rest-crud" });
		const earlier = await createAs(EVE, ws, { name: "Earlier" });
		await as(EVE).send("delete", `/collections/${earlier.id}`);
		await createAs(EVE, ws, { name: "Second" });
		const dry = await as(ADA).send("delete", `/workspaces/${ws}?dryRun=true`);
		expect(dry.body).toMatchObject({ dryRun: true, collections: 2 });
		const res = await as(ADA).send("delete", `/workspaces/${ws}`);
		expect(res.body).toMatchObject({ deleted: true, collections: 2 });
		expect((await as(EVE).get(`/collections/${id}`)).status).toBe(404);
		for (const sub of [ADA, EVE]) {
			const trash = (await trashOf(sub)).body.items;
			expect(trash).toHaveLength(3);
			expect(trash).toContainEqual(
				expect.objectContaining({
					id,
					workspaceName: null,
					deletedBy: ADA,
					requestCount: 5,
				}),
			);
		}
		expect((await trashOf(VIC)).body.items).toEqual([]);
		expect((await restore(VIC, id, ws)).status).toBe(404);
		expect((await restore(OLLIE, id, ws)).status).toBe(404);
		const home = (await personalWorkspace(EVE)).toHexString();
		const personal = await restore(EVE, id, home);
		expect(personal.body.error.code).toBe("TEAM_TO_PERSONAL");
		const team = (
			await teamWorkspace({ [EVE]: "editor", [OLLIE]: "admin" }, "Next")
		).toHexString();
		const restored = await restore(EVE, earlier.id, team);
		expect(restored.status).toBe(200);
		expect(restored.body).toMatchObject({ workspaceId: team, role: "editor" });
		const row = await CollectionModel.findById(earlier.id).lean();
		expect(row?.trashEditors).toBeUndefined();
	});
});
