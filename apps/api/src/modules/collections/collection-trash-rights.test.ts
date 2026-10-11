import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import {
	createAs,
	restoreAs as restore,
	trashOf,
	trashedCrud,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

const setRole = (ws: string, userId: string, role: string) =>
	WorkspaceMemberModel.updateOne(
		{ workspaceId: ws, userId },
		{ $set: { role } },
	);
const purge = (sub: string, id: string) =>
	as(sub).send("delete", `/trash/collections/${id}`);

describe("trash rights follow the current role", () => {
	it("drops a demoted or removed deleter and admits a promoted member", async () => {
		const { ws, id } = await trashedCrud();
		await setRole(ws, EVE, "viewer");
		expect((await trashOf(EVE)).body.items).toEqual([]);
		expect((await restore(EVE, id, ws)).status).toBe(404);
		expect((await purge(EVE, id)).status).toBe(404);
		await WorkspaceMemberModel.deleteOne({ workspaceId: ws, userId: EVE });
		expect((await restore(EVE, id, ws)).status).toBe(404);
		expect((await purge(EVE, id)).status).toBe(404);

		expect((await trashOf(VIC)).body.items).toEqual([]);
		await setRole(ws, VIC, "editor");
		const [item] = (await trashOf(VIC)).body.items;
		expect(item).toMatchObject({ id, deletedBy: EVE, requestCount: 5 });
		const res = await restore(VIC, id, ws);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ workspaceId: ws, role: "editor" });
	});

	it("applies the move rule when restoring elsewhere", async () => {
		const { id } = await trashedCrud();
		const other = (
			await teamWorkspace({ [ADA]: "editor", [OLLIE]: "admin" }, "Other")
		).toHexString();
		const adaHome = (await personalWorkspace(ADA)).toHexString();
		expect((await restore(ADA, id, adaHome)).body.error.code).toBe(
			"TEAM_TO_PERSONAL",
		);
		// Ollie adds to the target but holds no role where it was deleted.
		expect((await restore(OLLIE, id, other)).status).toBe(404);
		const res = await restore(ADA, id, other);
		expect(res.status).toBe(200);
		expect(res.body.workspaceId).toBe(other);
	});

	it("lets a personal collection go back home or to a team", async () => {
		const home = (await personalWorkspace(ADA)).toHexString();
		const team = (
			await teamWorkspace({ [ADA]: "admin" }, "Team")
		).toHexString();
		const first = await createAs(ADA, home, { name: "Mine" });
		const second = await createAs(ADA, home, { name: "Also mine" });
		for (const { id } of [first, second]) {
			expect((await as(ADA).send("delete", `/collections/${id}`)).status).toBe(
				200,
			);
		}
		expect((await trashOf(EVE)).body.items).toEqual([]);
		expect((await restore(EVE, first.id, home)).status).toBe(404);
		expect((await restore(ADA, first.id, home)).status).toBe(200);
		expect((await restore(ADA, second.id, team)).status).toBe(200);
	});
});

describe("caller roles on collections", () => {
	it("reports the effective role in the list and the detail", async () => {
		const ws = (
			await teamWorkspace({ [ADA]: "admin", [VIC]: "viewer" })
		).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Roles" });
		const roleIn = async (sub: string) =>
			(await as(sub).get(`/workspaces/${ws}/collections`)).body.items[0]?.role;
		expect(await roleIn(ADA)).toBe("editor");
		expect(await roleIn(VIC)).toBe("viewer");
		expect((await as(VIC).get(`/collections/${id}`)).body.role).toBe("viewer");
		const share = (usernameOrEmail: string, role: string) =>
			as(ADA).send("post", `/elements/collection/${id}/shares`, {
				usernameOrEmail,
				role,
			});
		await share("ollie", "viewer");
		expect(await roleIn(OLLIE)).toBe("viewer");
		await share("vic", "editor");
		expect(await roleIn(VIC)).toBe("editor");
		expect((await as(VIC).get(`/collections/${id}`)).body.role).toBe("editor");
	});
});
