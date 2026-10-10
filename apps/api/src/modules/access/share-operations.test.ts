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
	notificationsOf,
	patchAs,
	personalWorkspace,
	teamWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";

useAccessTestDb();

async function teamCollection() {
	const ws = await teamWorkspace({
		[ADA]: "admin",
		[EVE]: "editor",
		[VIC]: "viewer",
	});
	return { ws, element: addElement("collection", ws) };
}

describe("sharing.shareElement", () => {
	it("shares with an account, notifies it and returns Manage access", async () => {
		const { element } = await teamCollection();
		const res = await as(EVE).send("post", elementPath(element, "/shares"), {
			usernameOrEmail: "@Ollie",
			role: "viewer",
		});
		expect(res.status).toBe(200);
		expect(res.body.shares).toEqual([
			expect.objectContaining({ userId: OLLIE, role: "viewer" }),
		]);
		expect((await as(OLLIE).get(elementPath(element))).body.role).toBe(
			"viewer",
		);
		expect(await notificationsOf(OLLIE)).toEqual([
			expect.objectContaining({
				type: "element.shared",
				params: {
					sharer: "Eve",
					elementType: "collection",
					element: "Orders API",
					role: "viewer",
				},
				link: elementPath(element),
			}),
		]);
	});

	it("raises an existing share, never lowers it", async () => {
		const { element } = await teamCollection();
		const share = (role: string) =>
			as(ADA).send("post", elementPath(element, "/shares"), {
				usernameOrEmail: "ollie",
				role,
			});
		await share("viewer");
		expect((await share("editor")).body.shares[0].role).toBe("editor");
		expect((await share("viewer")).body.shares[0].role).toBe("editor");
		expect(await ElementRoleModel.countDocuments()).toBe(1);
	});

	it("holds an email share for an address without an account", async () => {
		const { element } = await teamCollection();
		const res = await as(ADA).send("post", elementPath(element, "/shares"), {
			usernameOrEmail: "New@Example.com",
			role: "editor",
		});
		expect(res.status).toBe(200);
		expect(res.body.shares).toEqual([
			expect.objectContaining({
				userId: null,
				email: "new@example.com",
				role: "editor",
			}),
		]);
	});

	it("refuses viewers, outsiders, personal workspaces, self and unknown names", async () => {
		const { element } = await teamCollection();
		const share = (sub: string, path: string, usernameOrEmail = "ollie") =>
			as(sub).send("post", path, { usernameOrEmail, role: "viewer" });
		const path = elementPath(element, "/shares");
		expect((await share(VIC, path)).status).toBe(403);
		expect((await share(OLLIE, path)).status).toBe(404);
		const self = await share(ADA, path, "ada");
		expect(self.status).toBe(400);
		expect(self.body.error.code).toBe("CANNOT_SHARE_SELF");
		const unknown = await share(ADA, path, "ghost");
		expect(unknown.status).toBe(404);
		expect(unknown.body.error.code).toBe("INVITEE_NOT_FOUND");
		const mine = addElement("collection", await personalWorkspace(ADA));
		const personal = await share(ADA, elementPath(mine, "/shares"));
		expect(personal.status).toBe(409);
		expect(personal.body.error.code).toBe("PERSONAL_WORKSPACE");
		expect(await ElementRoleModel.countDocuments()).toBe(0);
	});

	it("includes an environment the caller manages, with the same role", async () => {
		const { ws, element } = await teamCollection();
		const environment = addElement("environment", ws);
		const res = await as(EVE).send("post", elementPath(element, "/shares"), {
			usernameOrEmail: "ollie",
			role: "editor",
			includeEnvironmentId: environment.id,
		});
		expect(res.status).toBe(200);
		expect((await as(OLLIE).get(elementPath(environment))).body.role).toBe(
			"editor",
		);
		expect(
			(await notificationsOf(OLLIE)).map((n) => n.params.elementType),
		).toEqual(["collection", "environment"]);
	});

	it("refuses an included environment the caller cannot manage", async () => {
		const { ws, element } = await teamCollection();
		const viewerOnly = await teamWorkspace({ [EVE]: "viewer" }, "Other");
		const foreign = addElement("environment", viewerOnly);
		const send = (body: object, path = elementPath(element, "/shares")) =>
			as(EVE).send("post", path, {
				usernameOrEmail: "ollie",
				role: "viewer",
				...body,
			});
		expect((await send({ includeEnvironmentId: foreign.id })).status).toBe(403);
		expect((await send({ includeEnvironmentId: "missing" })).status).toBe(404);
		const environment = addElement("environment", ws);
		const fromEnvironment = await send(
			{ includeEnvironmentId: environment.id },
			elementPath(environment, "/shares"),
		);
		expect(fromEnvironment.status).toBe(400);
		expect(await ElementRoleModel.countDocuments()).toBe(0);
	});
});

describe("sharing.updateElementShare and sharing.removeElementShare", () => {
	it("change and remove a share; viewers get 403, unknown shares 404", async () => {
		const { element } = await teamCollection();
		const shared = await as(ADA).send("post", elementPath(element, "/shares"), {
			usernameOrEmail: "ollie",
			role: "editor",
		});
		const shareId: string = shared.body.shares[0].id;
		const path = elementPath(element, `/shares/${shareId}`);
		expect((await patchAs(VIC, path, { role: "viewer" })).status).toBe(403);
		expect(
			(
				await patchAs(
					ADA,
					elementPath(element, "/shares/0123456789abcdef01234567"),
					{ role: "viewer" },
				)
			).status,
		).toBe(404);
		const lowered = await patchAs(ADA, path, { role: "viewer" });
		expect(lowered.status).toBe(200);
		expect(lowered.body.shares[0].role).toBe("viewer");
		expect((await as(VIC).send("delete", path)).status).toBe(403);
		const preview = await as(ADA).send("delete", `${path}?dryRun=true`);
		expect(preview.body).toMatchObject({
			dryRun: true,
			removed: false,
			share: { id: shareId, userId: OLLIE },
		});
		expect(await ElementRoleModel.countDocuments()).toBe(1);
		const removed = await as(ADA).send("delete", path);
		expect(removed.body).toMatchObject({ dryRun: false, removed: true });
		expect((await as(OLLIE).get(elementPath(element))).status).toBe(404);
		expect((await as(ADA).send("delete", path)).status).toBe(404);
	});
});
