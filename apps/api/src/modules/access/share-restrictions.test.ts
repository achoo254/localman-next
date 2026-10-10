import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { AccessRequestModel } from "./access-request-model.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	OLLIE,
	UNA,
	addElement,
	elementPath,
	notificationsOf,
	teamWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";

useAccessTestDb();

const share = (sub: string, path: string, usernameOrEmail: string) =>
	as(sub).send("post", `${path}/shares`, { usernameOrEmail, role: "editor" });

describe("who a share binds to", () => {
	it("keeps an email share for an unverified look-alike account", async () => {
		const element = addElement(
			"collection",
			await teamWorkspace({ [ADA]: "admin" }),
		);
		const res = await share(ADA, elementPath(element), "UNA@example.com");
		expect(res.status).toBe(200);
		expect(res.body.shares).toEqual([
			expect.objectContaining({
				userId: null,
				email: "una@example.com",
				role: "editor",
			}),
		]);
		expect((await as(UNA).get(elementPath(element))).status).toBe(404);
		expect(await notificationsOf(UNA)).toEqual([]);
	});

	it("binds a verified email and a username to their account", async () => {
		const element = addElement(
			"collection",
			await teamWorkspace({ [ADA]: "admin" }),
		);
		await share(ADA, elementPath(element), "ollie@example.com");
		await share(ADA, elementPath(element), "una");
		const rows = await ElementRoleModel.find().sort({ _id: 1 }).lean();
		expect(rows.map((row) => [row.userId, row.email])).toEqual([
			[OLLIE, undefined],
			[UNA, undefined],
		]);
		expect((await as(UNA).get(elementPath(element))).body.role).toBe("editor");
	});
});

describe("elements whose workspace is gone", () => {
	it("cannot be shared, and requests for them store nothing", async () => {
		const ws = await teamWorkspace({ [ADA]: "admin" });
		const element = addElement("collection", ws);
		await ElementRoleModel.create({
			elementType: "collection",
			elementId: element.id,
			userId: OLLIE,
			role: "editor",
			grantedBy: ADA,
		});
		await WorkspaceModel.deleteOne({ _id: ws });
		const orphan = await share(OLLIE, elementPath(element), "una");
		expect(orphan.status).toBe(409);
		expect(orphan.body.error.code).toBe("WORKSPACE_MISSING");
		expect((await share(UNA, elementPath(element), "ada")).status).toBe(404);
		const asked = await as(UNA).send(
			"post",
			elementPath(element, "/access-requests"),
			{ role: "viewer" },
		);
		expect(asked.body).toEqual({ status: "sent" });
		expect(await AccessRequestModel.countDocuments()).toBe(0);
	});
});
