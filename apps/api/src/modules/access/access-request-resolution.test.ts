import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { AccessRequestModel } from "./access-request-model.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	elementPath,
	notificationsOf,
	useAccessTestDb,
} from "./testing/access-fixture.js";
import {
	ask,
	askAsOllie,
	teamCollection,
} from "./testing/access-request-helpers.js";

useAccessTestDb();

describe("sharing.getAccessRequest", () => {
	it("shows the request to Editors only", async () => {
		const element = await teamCollection();
		const requestId = await askAsOllie(elementPath(element));
		const res = await as(EVE).get(`/access-requests/${requestId}`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			id: requestId,
			element: { type: "collection", id: element.id, name: "Orders API" },
			requester: { username: "ollie", name: null, picture: null },
			role: "viewer",
			message: "Need it for the release",
			status: "pending",
			createdAt: expect.any(String),
		});
		for (const sub of [VIC, OLLIE]) {
			expect((await as(sub).get(`/access-requests/${requestId}`)).status).toBe(
				404,
			);
		}
		expect((await as(ADA).get("/access-requests/nope")).status).toBe(404);
	});
});

describe("sharing.approveAccessRequest and sharing.denyAccessRequest", () => {
	it("approve shares the element and tells the requester", async () => {
		const element = await teamCollection();
		const requestId = await askAsOllie(elementPath(element), "editor");
		const path = `/access-requests/${requestId}`;
		expect(
			(await as(VIC).send("post", `${path}/approve`, { role: "editor" }))
				.status,
		).toBe(403);
		expect(
			(await as(OLLIE).send("post", `${path}/approve`, { role: "editor" }))
				.status,
		).toBe(404);
		const approved = await as(EVE).send("post", `${path}/approve`, {
			role: "editor",
		});
		expect(approved.status).toBe(200);
		expect(approved.body.status).toBe("approved");
		expect((await as(OLLIE).get(elementPath(element))).body.role).toBe(
			"editor",
		);
		expect(await notificationsOf(OLLIE)).toEqual([
			expect.objectContaining({
				type: "access.resolved",
				params: {
					elementType: "collection",
					element: "Orders API",
					role: "editor",
					approved: true,
				},
				link: elementPath(element),
			}),
		]);
		const again = await as(ADA).send("post", `${path}/deny`);
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("ALREADY_RESOLVED");
		const list = await as(ADA).get("/notifications");
		expect(list.body.items[0].accessRequest).toEqual({
			id: requestId,
			status: "approved",
			role: "editor",
			notifiedRole: "editor",
		});
	});

	it("deny shares nothing, tells the requester, and allows asking again", async () => {
		const element = await teamCollection();
		const requestId = await askAsOllie(elementPath(element));
		const denied = await as(ADA).send(
			"post",
			`/access-requests/${requestId}/deny`,
		);
		expect(denied.status).toBe(200);
		expect(denied.body.status).toBe("denied");
		expect((await as(OLLIE).get(elementPath(element))).status).toBe(404);
		expect(await ElementRoleModel.countDocuments()).toBe(0);
		expect((await notificationsOf(OLLIE))[0]?.params.approved).toBe(false);
		expect((await ask(OLLIE, elementPath(element), "viewer")).status).toBe(200);
		expect(await AccessRequestModel.countDocuments({ status: "pending" })).toBe(
			1,
		);
	});

	it("approves only the role the approver saw", async () => {
		const element = await teamCollection();
		const requestId = await askAsOllie(elementPath(element), "viewer");
		const path = `/access-requests/${requestId}/approve`;
		expect((await as(ADA).send("post", path, {})).status).toBe(400);
		await ask(OLLIE, elementPath(element), "editor");
		// Each notification keeps the role it announced; the request has one role now.
		const list = await as(ADA).get("/notifications");
		expect(
			list.body.items.map(
				(item: { accessRequest: unknown }) => item.accessRequest,
			),
		).toEqual([
			{
				id: requestId,
				status: "pending",
				role: "editor",
				notifiedRole: "editor",
			},
			{
				id: requestId,
				status: "pending",
				role: "editor",
				notifiedRole: "viewer",
			},
		]);
		const stale = await as(ADA).send("post", path, { role: "viewer" });
		expect(stale.status).toBe(409);
		expect(stale.body.error.code).toBe("REQUEST_CHANGED");
		expect(await ElementRoleModel.countDocuments()).toBe(0);
		const fresh = await as(ADA).send("post", path, { role: "editor" });
		expect(fresh.status).toBe(200);
		expect((await as(OLLIE).get(elementPath(element))).body.role).toBe(
			"editor",
		);
	});
});
