import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
import {
	createAs,
	useCollectionTestDb,
} from "../collections/testing/collection-fixture.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import {
	SENSITIVE_TREE,
	enableLinkAs,
	expectNoSecrets,
	sensitiveCollection,
	setSharing,
} from "./testing/public-sharing-fixture.js";

useCollectionTestDb();

const view = (sub: string, linkId: string) =>
	as(sub).send("post", "/guest-links/view", { linkId });

describe("guest links", () => {
	it("show the redacted collection and grant nothing", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "guest");
		const members = await WorkspaceMemberModel.countDocuments();
		const res = await view(OLLIE, linkId);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({
			collectionId: id,
			name: "Payments",
			canRequestAccess: true,
			alreadyHasAccess: false,
		});
		expectNoSecrets(res.body);
		expect(await ElementRoleModel.countDocuments()).toBe(0);
		expect(await WorkspaceMemberModel.countDocuments()).toBe(members);
		expect((await as(OLLIE).get(`/collections/${id}`)).status).toBe(404);
	});

	it("need a session and keep the link id out of the URL", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "guest");
		const anonymous = await guest().send("post", "/guest-links/view", {
			linkId,
		});
		expect(anonymous.status).toBe(401);
		// A guest link is not a public link.
		expect((await guest().get(`/public/links/${linkId}`)).status).toBe(404);
	});

	it("lead to real access only once an Editor approves the request", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "guest");
		const asked = await as(OLLIE).send(
			"post",
			`/elements/collection/${id}/access-requests`,
			{ role: "editor" },
		);
		expect(asked.status, JSON.stringify(asked.body)).toBe(200);
		const request = await AccessRequestModel.findOne({ requesterId: OLLIE });
		expect(request).not.toBeNull();
		const approved = await as(EVE).send(
			"post",
			`/access-requests/${request?._id.toHexString()}/approve`,
			{ role: "editor" },
		);
		expect(approved.status, JSON.stringify(approved.body)).toBe(200);
		const after = await view(OLLIE, linkId);
		expect(after.body).toMatchObject({
			alreadyHasAccess: true,
			canRequestAccess: false,
		});
		expect((await as(OLLIE).get(`/collections/${id}`)).status).toBe(200);
	});

	it("offer no access request in a personal workspace", async () => {
		const ws = (await personalWorkspace(EVE)).toHexString();
		const { id } = await createAs(EVE, ws, { tree: SENSITIVE_TREE });
		const linkId = await enableLinkAs(EVE, id, "guest");
		const res = await view(OLLIE, linkId);
		expect(res.body.canRequestAccess).toBe(false);
	});

	it("stop at once when guests are turned off or the creator loses Editor", async () => {
		const { ws, id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "guest");
		await setSharing(ws, { guestsAllowed: false });
		expect((await view(OLLIE, linkId)).status).toBe(404);
		const blocked = await as(EVE).send("post", `/collections/${id}/guest-link`);
		expect(blocked.body.error.code).toBe("GUESTS_DISABLED");
		await setSharing(ws, { guestsAllowed: true });
		expect((await view(OLLIE, linkId)).status).toBe(200);
		await WorkspaceMemberModel.updateOne({ userId: EVE }, { role: "viewer" });
		expect((await view(OLLIE, linkId)).status).toBe(404);
	});

	it("can be turned on only by Admin and Editor members", async () => {
		const { id } = await sensitiveCollection();
		expect(
			(await as(VIC).send("post", `/collections/${id}/guest-link`)).status,
		).toBe(403);
		await enableLinkAs(ADA, id, "guest");
	});
});
