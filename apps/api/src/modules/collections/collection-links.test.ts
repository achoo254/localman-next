import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	patchAs,
} from "../access/testing/access-fixture.js";
import { registerEnvironmentAdapter } from "../environments/environment-access.js";
import {
	createEnvironmentAs,
	testKeyring,
	useVariableKeyring,
} from "../environments/testing/environment-fixture.js";
import { ProjectModel } from "../projects/project-model.js";
import {
	createAs,
	teamOfThree,
	useCollectionTestDb,
} from "./testing/collection-fixture.js";

useCollectionTestDb();
beforeEach(() => {
	registerEnvironmentAdapter();
	useVariableKeyring(testKeyring());
});
afterEach(() => configureRuntime(DEFAULT_RUNTIME_SETTINGS));

let slot = 0;
/** A mock project owned by `owner`, written straight to the database. */
async function projectOf(owner: string, name: string): Promise<string> {
	slot += 1;
	const [project] = await ProjectModel.create([
		{
			name,
			owner,
			quotaSlot: slot,
			secret: randomBytes(8).toString("hex"),
		},
	]);
	if (!project) throw new Error("no project");
	return project._id.toHexString();
}

const detailOf = async (sub: string, id: string) => {
	const res = await as(sub).get(`/collections/${id}`);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return res.body;
};

describe("collection links", () => {
	it("keeps the mock project it was made from, named only to readers", async () => {
		const ws = (await teamOfThree()).toHexString();
		const projectId = await projectOf(EVE, "Shop mock");
		const created = await createAs(EVE, ws, {
			name: "Shop",
			mockProjectId: projectId,
		});
		expect(created.mockProject).toEqual({ id: projectId, name: "Shop mock" });
		// Vic reads the collection but not Eve's project: no name leaks.
		expect((await detailOf(VIC, created.id)).mockProject).toBeNull();
		const foreign = await projectOf(OLLIE, "Private");
		const refused = await as(EVE).send(
			"post",
			`/workspaces/${ws}/collections`,
			{
				name: "Nope",
				mockProjectId: foreign,
			},
		);
		expect(refused.status).toBe(400);
		expect(refused.body.error.code).toBe("INVALID_MOCK_PROJECT");
		// A project being deleted no longer shows.
		await ProjectModel.updateOne(
			{ _id: new Types.ObjectId(projectId) },
			{ $set: { deletingAt: new Date() } },
		);
		expect((await detailOf(EVE, created.id)).mockProject).toBeNull();
	});

	it("links an environment of the same workspace, editors only", async () => {
		const ws = (await teamOfThree()).toHexString();
		const other = (await teamOfThree("Other")).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		const staging = await createEnvironmentAs(ADA, ws, { name: "Staging" });
		const elsewhere = await createEnvironmentAs(ADA, other, { name: "Far" });
		const path = `/collections/${id}`;
		const wrong = await patchAs(EVE, path, {
			linkedEnvironmentId: elsewhere.id,
		});
		expect(wrong.status).toBe(400);
		expect(wrong.body.error.code).toBe("INVALID_ENVIRONMENT_LINK");
		expect(
			(await patchAs(VIC, path, { linkedEnvironmentId: staging.id })).status,
		).toBe(403);
		const linked = await patchAs(EVE, path, {
			linkedEnvironmentId: staging.id,
		});
		expect(linked.status, JSON.stringify(linked.body)).toBe(200);
		expect(linked.body.relatedEnvironment).toEqual({
			id: staging.id,
			name: "Staging",
			color: staging.color,
			source: "linked",
		});
		expect((await detailOf(VIC, id)).relatedEnvironment?.id).toBe(staging.id);
		// Links stay out of the changelog.
		const log = await as(EVE).get(`${path}/changelog`);
		expect(
			log.body.sessions.flatMap((s: { changes: unknown[] }) => s.changes),
		).toHaveLength(1);
		const cleared = await patchAs(EVE, path, { linkedEnvironmentId: null });
		expect(cleared.body.relatedEnvironment).toBeNull();
	});

	it("defaults to the environment shared with it until an editor chooses", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		const staging = await createEnvironmentAs(ADA, ws, { name: "Staging" });
		const prod = await createEnvironmentAs(ADA, ws, { name: "Prod" });
		const shared = await as(ADA).send(
			"post",
			`/elements/collection/${id}/shares`,
			{
				usernameOrEmail: "ollie",
				role: "viewer",
				includeEnvironmentId: staging.id,
			},
		);
		expect(shared.status, JSON.stringify(shared.body)).toBe(200);
		const expected = { id: staging.id, name: "Staging", source: "shared" };
		expect((await detailOf(ADA, id)).relatedEnvironment).toMatchObject(
			expected,
		);
		expect((await detailOf(OLLIE, id)).relatedEnvironment).toMatchObject(
			expected,
		);
		const path = `/collections/${id}`;
		await patchAs(ADA, path, { linkedEnvironmentId: prod.id });
		expect((await detailOf(ADA, id)).relatedEnvironment).toMatchObject({
			id: prod.id,
			source: "linked",
		});
		// Ollie holds no role on Prod: its name stays hidden from him.
		expect((await detailOf(OLLIE, id)).relatedEnvironment).toBeNull();
		// "None" chosen by an editor wins over the shared one.
		await patchAs(ADA, path, { linkedEnvironmentId: null });
		expect((await detailOf(ADA, id)).relatedEnvironment).toBeNull();
	});

	it("shows nothing once the related environment is deleted", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		const staging = await createEnvironmentAs(ADA, ws, { name: "Staging" });
		await patchAs(ADA, `/collections/${id}`, {
			linkedEnvironmentId: staging.id,
		});
		const removed = await as(ADA).send("delete", `/environments/${staging.id}`);
		expect(removed.status, JSON.stringify(removed.body)).toBe(200);
		expect((await detailOf(ADA, id)).relatedEnvironment).toBeNull();
	});
});
