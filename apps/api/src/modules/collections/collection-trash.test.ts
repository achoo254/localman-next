import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionFavoriteModel } from "./collection-favorite-model.js";
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

useCollectionTestDb();

describe("collection trash", () => {
	it('needs "delete" typed for a collection with requests', async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { template: "rest-crud" });
		const path = `/collections/${id}`;
		const dry = await as(EVE).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toMatchObject({
			dryRun: true,
			deleted: false,
			folders: 1,
			requests: 5,
		});
		const missing = await as(EVE).send("delete", path);
		expect(missing.status).toBe(400);
		expect(missing.body.error.code).toBe("CONFIRMATION_REQUIRED");
		expect(
			(await as(EVE).send("delete", path, { confirm: "DELETE" })).status,
		).toBe(400);
		expect(
			(await as(VIC).send("delete", path, { confirm: "delete" })).status,
		).toBe(403);
		const res = await as(EVE).send("delete", path, { confirm: "delete" });
		expect(res.body).toMatchObject({ deleted: true, requests: 5 });
		expect((await as(ADA).get(path)).status).toBe(404);
		expect(
			(await as(ADA).get(`/workspaces/${ws}/collections`)).body.items,
		).toEqual([]);
		const empty = await createAs(ADA, ws, { name: "Empty" });
		expect(
			(await as(ADA).send("delete", `/collections/${empty.id}`)).status,
		).toBe(200);
	});

	it("lets a share-only Editor edit but not delete", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Shared" });
		await as(ADA).send("post", `/elements/collection/${id}/shares`, {
			usernameOrEmail: "ollie",
			role: "editor",
		});
		const path = `/collections/${id}`;
		expect(
			(
				await as(OLLIE).send("post", `${path}/nodes`, {
					kind: "folder",
					parentId: null,
					name: "Mine",
				})
			).status,
		).toBe(201);
		expect((await as(OLLIE).send("delete", path)).status).toBe(403);
		const outsider = (await personalWorkspace(OLLIE)).toHexString();
		const moved = await as(OLLIE).send(
			"post",
			`/elements/collection/${id}/move`,
			{ workspaceId: outsider },
		);
		expect(moved.status).toBe(403);
	});

	it("lists what the caller may restore and restores into a chosen workspace", async () => {
		const { ws, id } = await trashedCrud();
		const other = (
			await teamWorkspace({ [EVE]: "admin", [VIC]: "viewer" }, "Other")
		).toHexString();
		const [item] = (await trashOf(ADA)).body.items;
		expect(item).toMatchObject({
			id,
			workspaceId: ws,
			workspaceName: "Team",
			deletedBy: EVE,
			deletedByName: "Eve",
		});
		const purgeAt =
			new Date(item.purgeAt).getTime() - new Date(item.deletedAt).getTime();
		expect(purgeAt).toBe(TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
		expect((await trashOf(EVE, `?workspaceId=${ws}`)).body.items).toHaveLength(
			1,
		);
		expect(
			(await trashOf(EVE, `?workspaceId=${other}`)).body.items,
		).toHaveLength(0);
		expect((await trashOf(VIC)).body.items).toEqual([]);
		expect((await restore(VIC, id, ws)).status).toBe(404);
		expect((await restore(OLLIE, id, ws)).status).toBe(404);
		// Ada may restore it but adds nothing to Eve's other workspace.
		expect((await restore(ADA, id, other)).status).toBe(404);
		const res = await restore(EVE, id, other);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ id, workspaceId: other });
		expect(res.body.nodes).toHaveLength(6);
		expect((await trashOf(EVE)).body.items).toEqual([]);
		expect((await restore(EVE, id, other)).status).toBe(404);
	});

	it("keeps team collections out of personal workspaces while the team exists", async () => {
		const { id } = await trashedCrud();
		const personal = (await personalWorkspace(EVE)).toHexString();
		const res = await restore(EVE, id, personal);
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("TEAM_TO_PERSONAL");
		const adaHome = (await personalWorkspace(ADA)).toHexString();
		expect((await restore(EVE, id, adaHome)).status).toBe(404);
	});

	it("deletes for good with nodes, favorites, shares and access requests", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { template: "rest-crud" });
		await as(VIC).send("put", `/collections/${id}/favorite`);
		await ElementRoleModel.create({
			elementType: "collection",
			elementId: id,
			userId: OLLIE,
			role: "viewer",
			grantedBy: ADA,
		});
		await AccessRequestModel.create({
			elementType: "collection",
			elementId: id,
			requesterId: OLLIE,
			role: "editor",
			status: "pending",
		});
		await as(ADA).send("delete", `/collections/${id}`, { confirm: "delete" });
		const path = `/trash/collections/${id}`;
		expect((await as(VIC).send("delete", path)).status).toBe(404);
		const dry = await as(EVE).send("delete", `${path}?dryRun=true`);
		expect(dry.body).toMatchObject({
			dryRun: true,
			deleted: false,
			nodes: 6,
			collection: { id },
		});
		expect(await CollectionModel.countDocuments()).toBe(1);
		expect((await as(EVE).send("delete", path)).body.deleted).toBe(true);
		const counts = await Promise.all([
			CollectionModel.countDocuments(),
			CollectionNodeModel.countDocuments(),
			CollectionFavoriteModel.countDocuments(),
			ElementRoleModel.countDocuments(),
			AccessRequestModel.countDocuments(),
		]);
		expect(counts).toEqual([0, 0, 0, 0, 0]);
		expect((await as(EVE).send("delete", path)).status).toBe(404);
	});
});
