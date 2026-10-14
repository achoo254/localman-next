import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, VIC } from "../access/testing/access-fixture.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { purgeCollection } from "../collections/trash-purge.js";
import { CollectionLinkModel } from "./collection-link-model.js";
import {
	enableLinkAs,
	sensitiveCollection,
} from "./testing/public-sharing-fixture.js";

useCollectionTestDb();

describe("workspace sharing switches", () => {
	it("are all on for a workspace that never set them", async () => {
		const { ws } = await sensitiveCollection();
		const res = await as(VIC).get(`/workspaces/${ws}/sharing`);
		expect(res.body).toEqual({
			publicLinksAllowed: true,
			guestsAllowed: true,
			accessKeysAllowed: true,
		});
	});

	it("count what stops on a dry run and change only for Admins", async () => {
		const { ws, id } = await sensitiveCollection();
		await enableLinkAs(EVE, id, "public");
		const path = `/workspaces/${ws}/sharing`;
		const editor = await as(EVE).send("patch", path, {
			publicLinksAllowed: false,
		});
		expect(editor.status).toBe(403);
		const preview = await as(ADA).send("patch", `${path}?dryRun=true`, {
			publicLinksAllowed: false,
		});
		expect(preview.body).toMatchObject({
			dryRun: true,
			sharing: { publicLinksAllowed: false, guestsAllowed: true },
			stopped: { links: 1, accessKeys: 0, runButtons: 0 },
		});
		expect((await as(ADA).get(path)).body.publicLinksAllowed).toBe(true);
		await as(ADA).send("patch", path, { publicLinksAllowed: false });
		expect((await as(ADA).get(path)).body).toMatchObject({
			publicLinksAllowed: false,
			guestsAllowed: true,
		});
		const blocked = await as(EVE).send(
			"post",
			`/collections/${id}/public-link`,
		);
		expect(blocked.body.error.code).toBe("PUBLIC_LINKS_DISABLED");
		// Turning a link off still works with the switch off.
		const off = await as(EVE).send("delete", `/collections/${id}/public-link`);
		expect(off.body.disabled).toBe(true);
	});

	it("keep both Admins' changes when they switch different things at once", async () => {
		const { ws } = await sensitiveCollection();
		const path = `/workspaces/${ws}/sharing`;
		await Promise.all([
			as(ADA).send("patch", path, { publicLinksAllowed: false }),
			as(ADA).send("patch", path, { guestsAllowed: false }),
		]);
		expect((await as(ADA).get(path)).body).toEqual({
			publicLinksAllowed: false,
			guestsAllowed: false,
			accessKeysAllowed: true,
		});
	});

	it("delete a collection's links with it when it is purged", async () => {
		const { id } = await sensitiveCollection();
		await enableLinkAs(EVE, id, "public");
		await as(EVE).send("delete", `/collections/${id}`, { confirm: "delete" });
		expect(await purgeCollection(new Types.ObjectId(id))).toBe(true);
		expect(await CollectionLinkModel.countDocuments()).toBe(0);
	});
});
