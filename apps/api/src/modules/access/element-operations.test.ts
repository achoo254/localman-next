import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	addElement,
	elementPath,
	teamWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";

useAccessTestDb();

describe("sharing.getElement", () => {
	it("returns the element and the caller's role, 404 without one", async () => {
		const ws = await teamWorkspace({ [ADA]: "admin", [VIC]: "viewer" });
		const element = addElement("collection", ws);
		const res = await as(VIC).get(elementPath(element));
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			type: "collection",
			id: element.id,
			name: "Orders API",
			workspaceId: ws.toHexString(),
			role: "viewer",
		});
		const hidden = await as(OLLIE).get(elementPath(element));
		expect(hidden.status).toBe(404);
		expect(hidden.body.error.code).toBe("NOT_FOUND");
		expect((await as(ADA).get("/elements/collection/nope")).status).toBe(404);
		expect((await as(ADA).get(`/elements/flow/${element.id}`)).status).toBe(
			400,
		);
	});
});

describe("sharing.getElementAccess", () => {
	it("lists the workspace and the shares, emails for Editors only", async () => {
		const ws = await teamWorkspace(
			{ [ADA]: "admin", [EVE]: "editor", [VIC]: "viewer" },
			"Payments",
		);
		const element = addElement("collection", ws);
		await ElementRoleModel.create([
			{
				elementType: "collection",
				elementId: element.id,
				userId: OLLIE,
				role: "editor",
				grantedBy: ADA,
			},
			{
				elementType: "collection",
				elementId: element.id,
				email: "new@example.com",
				role: "viewer",
				grantedBy: ADA,
			},
		]);
		const res = await as(ADA).get(elementPath(element, "/access"));
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			workspace: {
				id: ws.toHexString(),
				name: "Payments",
				type: "team",
				memberCount: 3,
			},
			shares: [
				{
					id: expect.any(String),
					userId: OLLIE,
					email: null,
					username: "ollie",
					name: null,
					picture: null,
					role: "editor",
				},
				{
					id: expect.any(String),
					userId: null,
					email: "new@example.com",
					username: null,
					name: null,
					picture: null,
					role: "viewer",
				},
			],
		});
		const viewer = await as(VIC).get(elementPath(element, "/access"));
		expect(viewer.status).toBe(200);
		expect(viewer.body.shares[1].email).toBeNull();
		expect(
			(await as("acc_nobody").get(elementPath(element, "/access"))).status,
		).toBe(404);
	});
});
