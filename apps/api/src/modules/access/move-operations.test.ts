import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	addElement,
	elementPath,
	fakeElements,
	personalWorkspace,
	teamWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";

useAccessTestDb();

async function shareAsEditor(elementId: string, userId: string): Promise<void> {
	await ElementRoleModel.create({
		elementType: "collection",
		elementId,
		userId,
		role: "editor",
		grantedBy: ADA,
	});
}

describe("sharing.moveElement", () => {
	it("checks both workspaces and refuses team to personal", async () => {
		const source = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "editor",
			[VIC]: "viewer",
		});
		const viewerTarget = await teamWorkspace({ [EVE]: "viewer" }, "Read only");
		const foreign = await teamWorkspace({ [OLLIE]: "admin" }, "Foreign");
		const personal = await personalWorkspace(EVE);
		const element = addElement("collection", source);
		const move = (sub: string, workspaceId: string) =>
			as(sub).send("post", elementPath(element, "/move"), { workspaceId });
		expect((await move(VIC, personal.toHexString())).status).toBe(403);
		expect((await move(OLLIE, foreign.toHexString())).status).toBe(404);
		expect((await move(EVE, foreign.toHexString())).status).toBe(404);
		expect((await move(EVE, "not-an-id")).status).toBe(404);
		expect((await move(EVE, viewerTarget.toHexString())).status).toBe(403);
		const same = await move(EVE, source.toHexString());
		expect(same.status).toBe(400);
		expect(same.body.error.code).toBe("SAME_WORKSPACE");
		const toPersonal = await move(EVE, personal.toHexString());
		expect(toPersonal.status).toBe(409);
		expect(toPersonal.body.error.code).toBe("TEAM_TO_PERSONAL");
		expect(fakeElements.get(`collection:${element.id}`)?.workspaceId).toEqual(
			source,
		);
	});

	it("moves from personal to team; inherited roles follow, shares stay", async () => {
		const personal = await personalWorkspace(ADA);
		const target = await teamWorkspace({ [ADA]: "admin", [VIC]: "viewer" });
		const element = addElement("environment", personal);
		const moved = await as(ADA).send("post", elementPath(element, "/move"), {
			workspaceId: target.toHexString(),
		});
		expect(moved.status).toBe(200);
		expect(moved.body).toMatchObject({
			workspaceId: target.toHexString(),
			role: "editor",
		});
		expect((await as(VIC).get(elementPath(element))).body.role).toBe("viewer");
	});

	it("takes inherited roles away from the source workspace's members", async () => {
		const source = await teamWorkspace({ [ADA]: "admin", [VIC]: "viewer" });
		const target = await teamWorkspace(
			{ [ADA]: "editor", [EVE]: "viewer" },
			"Target",
		);
		const element = addElement("collection", source);
		await ElementRoleModel.create({
			elementType: "collection",
			elementId: element.id,
			userId: OLLIE,
			role: "viewer",
			grantedBy: ADA,
		});
		expect((await as(EVE).get(elementPath(element))).status).toBe(404);
		const moved = await as(ADA).send("post", elementPath(element, "/move"), {
			workspaceId: target.toHexString(),
		});
		expect(moved.status).toBe(200);
		expect((await as(VIC).get(elementPath(element))).status).toBe(404);
		expect((await as(EVE).get(elementPath(element))).body.role).toBe("viewer");
		expect((await as(OLLIE).get(elementPath(element))).body.role).toBe(
			"viewer",
		);
	});

	it("needs Admin or Editor in the source workspace, not just a share", async () => {
		const source = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "editor",
			[VIC]: "viewer",
		});
		const target = await teamWorkspace(
			{ [EVE]: "admin", [VIC]: "admin", [OLLIE]: "admin" },
			"Target",
		);
		const element = addElement("collection", source);
		await shareAsEditor(element.id, OLLIE);
		await shareAsEditor(element.id, VIC);
		const move = (sub: string) =>
			as(sub).send("post", elementPath(element, "/move"), {
				workspaceId: target.toHexString(),
			});
		for (const sub of [OLLIE, VIC]) {
			const refused = await move(sub);
			expect(refused.status).toBe(403);
			expect(refused.body.error.code).toBe("FORBIDDEN");
		}
		expect(fakeElements.get(`collection:${element.id}`)?.workspaceId).toEqual(
			source,
		);
		expect((await move(EVE)).status).toBe(200);
	});

	it("refuses to move an element whose workspace is gone", async () => {
		const source = await teamWorkspace({ [ADA]: "admin" });
		const target = await teamWorkspace({ [OLLIE]: "admin" }, "Target");
		const element = addElement("collection", source);
		await shareAsEditor(element.id, OLLIE);
		await WorkspaceModel.deleteOne({ _id: source });
		const move = (sub: string) =>
			as(sub).send("post", elementPath(element, "/move"), {
				workspaceId: target.toHexString(),
			});
		const orphan = await move(OLLIE);
		expect(orphan.status).toBe(409);
		expect(orphan.body.error.code).toBe("WORKSPACE_MISSING");
		expect((await move(EVE)).status).toBe(404);
	});
});
