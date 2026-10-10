import { describe, expect, it } from "vitest";
import { AccessRequestModel } from "./access-request-model.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	UNA,
	VIC,
	addElement,
	elementPath,
	notificationsOf,
	personalWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";
import {
	ask,
	askAsOllie,
	teamCollection,
} from "./testing/access-request-helpers.js";

useAccessTestDb();

describe("sharing.requestElementAccess", () => {
	it("answers the same for missing elements and stores nothing", async () => {
		const missing = await ask(OLLIE, "/elements/collection/nope", "viewer");
		expect(missing.status).toBe(200);
		expect(missing.body).toEqual({ status: "sent" });
		const personal = addElement("collection", await personalWorkspace(ADA));
		expect((await ask(OLLIE, elementPath(personal), "viewer")).body).toEqual({
			status: "sent",
		});
		expect(await AccessRequestModel.countDocuments()).toBe(0);
		expect(await notificationsOf(ADA)).toEqual([]);
	});

	it("notifies every Editor once and keeps one pending request", async () => {
		const element = await teamCollection();
		await ElementRoleModel.create({
			elementType: "collection",
			elementId: element.id,
			userId: UNA,
			role: "editor",
			grantedBy: ADA,
		});
		const requestId = await askAsOllie(elementPath(element), "editor");
		expect((await ask(OLLIE, elementPath(element), "viewer")).status).toBe(200);
		expect(await AccessRequestModel.countDocuments()).toBe(1);
		for (const editor of [ADA, EVE, UNA]) {
			expect(await notificationsOf(editor)).toEqual([
				expect.objectContaining({
					type: "access.requested",
					params: {
						requester: "ollie",
						elementType: "collection",
						element: "Orders API",
						role: "editor",
						requestId,
					},
					link: `/access-requests/${requestId}`,
				}),
			]);
		}
		expect(await notificationsOf(VIC)).toEqual([]);
		expect(await notificationsOf(OLLIE)).toEqual([]);
	});

	it("upgrades a pending view request to edit and tells Editors again", async () => {
		const element = await teamCollection();
		const requestId = await askAsOllie(elementPath(element), "viewer");
		expect((await notificationsOf(EVE)).map((n) => n.params.role)).toEqual([
			"viewer",
		]);
		const upgraded = await ask(
			OLLIE,
			elementPath(element),
			"editor",
			"Edit too",
		);
		expect(upgraded.body).toEqual({ status: "sent" });
		const rows = await AccessRequestModel.find().lean();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ role: "editor", message: "Edit too" });
		expect(await notificationsOf(EVE)).toEqual([
			expect.objectContaining({
				params: expect.objectContaining({ role: "viewer" }),
			}),
			expect.objectContaining({
				params: expect.objectContaining({ role: "editor", requestId }),
			}),
		]);
		await ask(OLLIE, elementPath(element), "editor");
		await ask(OLLIE, elementPath(element), "viewer");
		const after = await AccessRequestModel.findOne().lean();
		expect(after).toMatchObject({ role: "editor", message: "Edit too" });
		expect(await notificationsOf(EVE)).toHaveLength(2);
	});

	it("refuses a role the caller already holds", async () => {
		const element = await teamCollection();
		const held = await ask(VIC, elementPath(element), "viewer");
		expect(held.status).toBe(409);
		expect(held.body.error.code).toBe("ALREADY_HAS_ACCESS");
		expect((await ask(EVE, elementPath(element), "editor")).status).toBe(409);
		expect((await ask(VIC, elementPath(element), "editor")).status).toBe(200);
	});
	it("limits requests per account, whatever the element", async () => {
		for (let i = 0; i < 20; i += 1) {
			const res = await ask(
				OLLIE,
				`/elements/collection/missing-${i}`,
				"viewer",
			);
			expect(res.status).toBe(200);
		}
		const limited = await ask(OLLIE, "/elements/environment/x", "viewer");
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		expect((await ask(UNA, "/elements/environment/x", "viewer")).status).toBe(
			200,
		);
	});
});
