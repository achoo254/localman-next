import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionModel } from "../collections/collection-model.js";
import { CollectionNodeModel } from "../collections/collection-node-model.js";
import {
	addNode,
	createAs,
	requestNode,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { UserModel } from "../users/user-model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { DELETED_USER } from "./account-references.js";
import { applyWorkspacePlan, planWorkspaces } from "./account-workspaces.js";

useCollectionTestDb();

const deleteAda = (dryRun = false) =>
	as(ADA).send(
		"delete",
		`/users/me${dryRun ? "?dryRun=true" : ""}`,
		dryRun ? {} : { confirm: "ada" },
	);

describe("account deletion and workspaces", () => {
	it("is blocked while the account is the only Admin of other members, and changes nothing", async () => {
		const ws = await teamWorkspace({ [ADA]: "admin", [EVE]: "editor" }, "Team");
		const preview = await deleteAda(true);
		expect(preview.body.blockedWorkspaces).toEqual([
			{ id: ws.toHexString(), name: "Team" },
		]);
		const res = await deleteAda();
		expect(res.status).toBe(409);
		expect(res.body.error).toMatchObject({
			code: "ACCOUNT_DELETION_BLOCKED",
			details: { blockedWorkspaces: 1 },
		});
		expect(await UserModel.exists({ sub: ADA })).toBeTruthy();
		expect(await WorkspaceMemberModel.countDocuments({ workspaceId: ws })).toBe(
			2,
		);
	});

	it("leaves a workspace that keeps an Admin, which becomes its owner", async () => {
		const ws = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "admin",
			[VIC]: "viewer",
		});
		const res = await deleteAda();
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({
			workspacesLeft: 1,
			blockedWorkspaces: [],
		});
		const workspace = await WorkspaceModel.findById(ws).lean();
		expect(workspace?.ownerId).toBe(EVE);
		expect(
			await WorkspaceMemberModel.exists({ workspaceId: ws, userId: ADA }),
		).toBeNull();
	});

	it("deletes the personal workspace and team workspaces the account is alone in, with their collections", async () => {
		const personal = (await personalWorkspace(ADA)).toHexString();
		const solo = (
			await teamWorkspace({ [ADA]: "admin" }, "Solo")
		).toHexString();
		const others = (
			await teamWorkspace({ [EVE]: "admin" }, "Eve's")
		).toHexString();
		await createAs(ADA, personal, { name: "Mine" });
		const soloCollection = await createAs(ADA, solo, { name: "Solo API" });
		await addNode(ADA, soloCollection.id, requestNode("List"));
		await createAs(EVE, others, { name: "Eve's API" });

		const preview = await deleteAda(true);
		expect(preview.body).toMatchObject({
			workspacesDeleted: 2,
			collectionsDeleted: 2,
		});
		expect((await deleteAda()).status).toBe(200);
		expect(await WorkspaceModel.exists({ _id: personal })).toBeNull();
		expect(await WorkspaceModel.exists({ _id: solo })).toBeNull();
		expect(
			await CollectionModel.countDocuments({
				workspaceId: { $in: [personal, solo] },
			}),
		).toBe(0);
		expect(
			await CollectionNodeModel.countDocuments({
				collectionId: soloCollection.id,
			}),
		).toBe(0);
		expect(await CollectionModel.countDocuments({ workspaceId: others })).toBe(
			1,
		);
	});

	it("purges trash of deleted workspaces only it could restore, and keeps the rest", async () => {
		const ws = (
			await teamWorkspace({ [EVE]: "admin", [ADA]: "editor" })
		).toHexString();
		const alone = await createAs(ADA, ws, { name: "Only Ada" });
		const shared = await createAs(ADA, ws, { name: "Ada and Eve" });
		const gone = new Types.ObjectId();
		const trash = (trashEditors: string[]) => ({
			$set: {
				workspaceId: gone,
				deletedAt: new Date(),
				deletedBy: ADA,
				trashEditors,
			},
		});
		await CollectionModel.updateOne({ _id: alone.id }, trash([ADA]));
		await CollectionModel.updateOne({ _id: shared.id }, trash([ADA, EVE]));

		expect((await deleteAda()).status).toBe(200);
		expect(await CollectionModel.exists({ _id: alone.id })).toBeNull();
		const kept = await CollectionModel.findById(shared.id).lean();
		expect(kept).toMatchObject({
			deletedBy: DELETED_USER,
			trashEditors: [EVE],
		});
	});

	it("stops, deleting nothing, when someone joined a workspace since the plan", async () => {
		const solo = await teamWorkspace({ [ADA]: "admin" }, "Solo");
		const kept = await createAs(ADA, solo.toHexString(), { name: "Kept" });
		const plan = await planWorkspaces(ADA);
		expect(plan.toDelete).toHaveLength(1);
		await WorkspaceMemberModel.create({
			workspaceId: solo,
			userId: EVE,
			role: "editor",
			status: "accepted",
			invitedBy: ADA,
		});
		await expect(applyWorkspacePlan(ADA, plan)).rejects.toMatchObject({
			status: 409,
			code: "ACCOUNT_DELETION_CONFLICT",
		});
		expect(await WorkspaceModel.exists({ _id: solo })).toBeTruthy();
		const collection = await CollectionModel.findById(kept.id).lean();
		expect(collection?.deletedAt).toBeUndefined();
	});
});
