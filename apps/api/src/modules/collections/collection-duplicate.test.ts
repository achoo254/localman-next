import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	OLLIE,
	VIC,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();

describe("collection duplicate", () => {
	it("duplicates with new node ids into a workspace the caller adds to", async () => {
		const ws = await teamOfThree();
		const { id, nodes } = await createAs(ADA, ws.toHexString(), {
			template: "rest-crud",
		});
		const vicHome = await personalWorkspace(VIC);
		const copy = await as(VIC).send("post", `/collections/${id}/duplicate`, {
			workspaceId: vicHome.toHexString(),
		});
		expect(copy.status).toBe(201);
		expect(copy.body).toMatchObject({
			name: "REST CRUD Copy",
			workspaceId: vicHome.toHexString(),
			createdBy: VIC,
		});
		expect(copy.body.nodes).toHaveLength(nodes.length);
		const ids = new Set(nodes.map((node) => node.id));
		for (const node of copy.body.nodes) expect(ids.has(node.id)).toBe(false);
		const folderCopy = copy.body.nodes.find(
			(node: { kind: string }) => node.kind === "folder",
		);
		expect(
			copy.body.nodes.filter(
				(node: { parentId: string | null }) => node.parentId === folderCopy.id,
			),
		).toHaveLength(5);
		// Vic views the source but adds nothing to the team workspace.
		expect(
			(await as(VIC).send("post", `/collections/${id}/duplicate`)).status,
		).toBe(403);
		expect(
			(await as(OLLIE).send("post", `/collections/${id}/duplicate`)).status,
		).toBe(404);
	});
});
