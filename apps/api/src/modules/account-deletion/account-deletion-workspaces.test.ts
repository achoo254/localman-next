import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
	ADA,
	EVE,
	OLLIE,
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
import { deleteAccount } from "./account-deletion-service.js";
import { DELETED_USER } from "./account-references.js";
import { applyWorkspacePlan, planWorkspaces } from "./account-workspaces.js";

useCollectionTestDb();

describe("account deletion and workspaces", () => {
	it("hands a workspace where it is the only Admin to the highest role, earliest to join", async () => {
		const ws = await teamWorkspace({
			[ADA]: "admin",
			[VIC]: "viewer",
			[EVE]: "editor",
			[OLLIE]: "editor",
		});
		const joined = (sub: string, day: number) =>
			WorkspaceMemberModel.updateOne(
				{ workspaceId: ws, userId: sub },
				{ $set: { acceptedAt: new Date(Date.UTC(2026, 0, day)) } },
			);
		await joined(VIC, 1);
		await joined(EVE, 3);
		await joined(OLLIE, 2);

		await deleteAccount(ADA);
		expect(await UserModel.exists({ sub: ADA })).toBeNull();
		const workspace = await WorkspaceModel.findById(ws).lean();
		expect(workspace?.ownerId).toBe(OLLIE);
		const roles = await WorkspaceMemberModel.find({ workspaceId: ws }).lean();
		expect(
			Object.fromEntries(roles.map((row) => [row.userId, row.role])),
		).toEqual({ [VIC]: "viewer", [EVE]: "editor", [OLLIE]: "admin" });
	});

	it("leaves a workspace that keeps an Admin, which becomes its owner", async () => {
		const ws = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "admin",
			[VIC]: "viewer",
		});
		await deleteAccount(ADA);
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

		await deleteAccount(ADA);
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

		await deleteAccount(ADA);
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
