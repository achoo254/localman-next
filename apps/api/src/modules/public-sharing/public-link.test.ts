import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { runInTenant } from "../../tenancy/tenant-context.js";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { CollectionModel } from "../collections/collection-model.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { CollectionLinkModel } from "./collection-link-model.js";
import { servedCollection } from "./collection-link-service.js";
import {
	enableLinkAs,
	expectNoSecrets,
	sensitiveCollection,
	setSharing,
} from "./testing/public-sharing-fixture.js";

useCollectionTestDb();

const read = (linkId: string, ip?: string) =>
	guest(ip).get(`/public/links/${linkId}`);

async function expectGone(linkId: string): Promise<void> {
	const res = await read(linkId);
	expect(res.status).toBe(404);
	expect(res.body.error).toEqual({
		code: "PUBLIC_LINK_NOT_FOUND",
		message: "This link does not exist or was turned off",
	});
}

describe("public links", () => {
	it("serves the redacted collection without a session", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "public");
		const res = await read(linkId);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.name).toBe("Payments");
		const [folder] = res.body.tree.items;
		const [request] = folder.items;
		expect(request.draft.url).toBe(
			"https://api.test/login?api_key&user={{userId}}",
		);
		expect(request.examples[0].response.status).toBe(200);
		expect(request.examples[0].response.body).toBe("");
		expect(res.body.tree.variables[0].value).toBe("https://api.test");
		expectNoSecrets(res.body);
	});

	it("previews warnings on a dry run and keeps the link while it stays on", async () => {
		const { id } = await sensitiveCollection();
		const preview = await as(EVE).send(
			"post",
			`/collections/${id}/public-link?dryRun=true`,
		);
		expect(preview.body).toMatchObject({ dryRun: true, link: null });
		expect(Array.isArray(preview.body.warnings)).toBe(true);
		expect(await CollectionLinkModel.countDocuments()).toBe(0);
		const first = await enableLinkAs(EVE, id, "public");
		expect(await enableLinkAs(ADA, id, "public")).toBe(first);
		const got = await as(VIC).get(`/collections/${id}/public-link`);
		expect(got.body.link.url).toBe(`http://localhost:5173/public/c/${first}`);
	});

	it("keeps one link when two Editors turn it on at once", async () => {
		await CollectionLinkModel.createIndexes();
		const { id } = await sensitiveCollection();
		const ids = await Promise.all([
			enableLinkAs(EVE, id, "public"),
			enableLinkAs(ADA, id, "public"),
		]);
		expect(ids[0]).toBe(ids[1]);
		expect(await CollectionLinkModel.countDocuments()).toBe(1);
	});

	it("lets only Admin and Editor members publish", async () => {
		const { id } = await sensitiveCollection();
		const viewer = await as(VIC).send("post", `/collections/${id}/public-link`);
		expect(viewer.status).toBe(403);
		const shared = await as(EVE).send(
			"post",
			`/elements/collection/${id}/shares`,
			{ usernameOrEmail: "ollie", role: "editor" },
		);
		expect(shared.status, JSON.stringify(shared.body)).toBe(200);
		const outsider = await as(OLLIE).send(
			"post",
			`/collections/${id}/public-link`,
		);
		expect(outsider.status).toBe(403);
		expect(outsider.body.error.code).toBe("FORBIDDEN");
	});

	it("turns off at once and gives a new address when turned on again", async () => {
		const { id } = await sensitiveCollection();
		const first = await enableLinkAs(EVE, id, "public");
		const preview = await as(EVE).send(
			"delete",
			`/collections/${id}/public-link?dryRun=true`,
		);
		expect(preview.body).toEqual({ dryRun: true, disabled: true });
		const off = await as(EVE).send("delete", `/collections/${id}/public-link`);
		expect(off.body).toEqual({ dryRun: false, disabled: true });
		await expectGone(first);
		expect(await enableLinkAs(EVE, id, "public")).not.toBe(first);
	});

	it("answers the same 404 for every reason a link cannot be served", async () => {
		const { ws, id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "public");
		await expectGone("not-a-link");
		await expectGone("A".repeat(43));
		// The creator is no longer an Editor of the workspace.
		await WorkspaceMemberModel.updateOne(
			{ workspaceId: new Types.ObjectId(ws), userId: EVE },
			{ role: "viewer" },
		);
		await expectGone(linkId);
		await WorkspaceMemberModel.updateOne(
			{ workspaceId: new Types.ObjectId(ws), userId: EVE },
			{ role: "editor" },
		);
		expect((await read(linkId)).status).toBe(200);
		// The Admin turned public links off.
		await setSharing(ws, { publicLinksAllowed: false });
		await expectGone(linkId);
		await setSharing(ws, { publicLinksAllowed: true });
		// The collection went to the trash.
		await CollectionModel.updateOne(
			{ _id: new Types.ObjectId(id) },
			{ deletedAt: new Date(), deletedBy: EVE },
		);
		await expectGone(linkId);
	});

	it("replaces a link whose creator can no longer publish", async () => {
		const { ws, id } = await sensitiveCollection();
		const old = await enableLinkAs(EVE, id, "public");
		await WorkspaceMemberModel.updateOne(
			{ workspaceId: new Types.ObjectId(ws), userId: EVE },
			{ role: "viewer" },
		);
		const fresh = await enableLinkAs(ADA, id, "public");
		expect(fresh).not.toBe(old);
		expect((await read(fresh)).status).toBe(200);
		await expectGone(old);
	});

	it("follows the switches of the workspace the collection moved to", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "public");
		const target = (
			await teamWorkspace({ [ADA]: "admin", [EVE]: "editor" }, "Target")
		).toHexString();
		await setSharing(target, { publicLinksAllowed: false });
		const moved = await as(ADA).send(
			"post",
			`/elements/collection/${id}/move`,
			{
				workspaceId: target,
			},
		);
		expect(moved.status, JSON.stringify(moved.body)).toBe(200);
		await expectGone(linkId);
		await setSharing(target, { publicLinksAllowed: true });
		expect((await read(linkId)).status).toBe(200);
	});
});
