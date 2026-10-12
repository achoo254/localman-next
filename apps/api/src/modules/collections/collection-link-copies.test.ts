import { randomBytes } from "node:crypto";
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
	personalWorkspace,
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

let slot = 100;
async function projectOf(owner: string, name: string): Promise<string> {
	slot += 1;
	const [project] = await ProjectModel.create([
		{ name, owner, quotaSlot: slot, secret: randomBytes(8).toString("hex") },
	]);
	if (!project) throw new Error("no project");
	return project._id.toHexString();
}

/** A team collection made from Eve's project, linked to Staging. */
async function linkedShop() {
	const ws = (await teamOfThree()).toHexString();
	const projectId = await projectOf(EVE, "Shop mock");
	const { id } = await createAs(EVE, ws, {
		name: "Shop",
		mockProjectId: projectId,
	});
	const staging = await createEnvironmentAs(EVE, ws, { name: "Staging" });
	const res = await patchAs(EVE, `/collections/${id}`, {
		linkedEnvironmentId: staging.id,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	return { ws, id, projectId, staging };
}

const duplicate = (sub: string, id: string, workspaceId?: string) =>
	as(sub).send("post", `/collections/${id}/duplicate`, {
		...(workspaceId ? { workspaceId } : {}),
	});

describe("links of copies and edits", () => {
	it("keeps both links when copied within its workspace", async () => {
		const { id, projectId, staging } = await linkedShop();
		const copy = await duplicate(EVE, id);
		expect(copy.status, JSON.stringify(copy.body)).toBe(201);
		expect(copy.body.mockProject).toEqual({ id: projectId, name: "Shop mock" });
		expect(copy.body.relatedEnvironment).toMatchObject({
			id: staging.id,
			source: "linked",
		});
	});

	it("drops the environment in another workspace, and a project the caller can't read", async () => {
		const { id, projectId } = await linkedShop();
		const eveOwn = (await personalWorkspace(EVE)).toHexString();
		const eveCopy = await duplicate(EVE, id, eveOwn);
		expect(eveCopy.status, JSON.stringify(eveCopy.body)).toBe(201);
		expect(eveCopy.body.relatedEnvironment).toBeNull();
		expect(eveCopy.body.mockProject?.id).toBe(projectId);
		// Vic views the collection but cannot read Eve's project.
		const vicOwn = (await personalWorkspace(VIC)).toHexString();
		const vicCopy = await duplicate(VIC, id, vicOwn);
		expect(vicCopy.status, JSON.stringify(vicCopy.body)).toBe(201);
		expect(vicCopy.body.mockProject).toBeNull();
		expect((await as(EVE).get(`/collections/${vicCopy.body.id}`)).status).toBe(
			404,
		);
	});

	it("sets and clears the mock project with PATCH", async () => {
		const { id } = await linkedShop();
		const other = await projectOf(EVE, "Billing mock");
		const set = await patchAs(EVE, `/collections/${id}`, {
			mockProjectId: other,
		});
		expect(set.body.mockProject).toEqual({ id: other, name: "Billing mock" });
		const foreign = await projectOf(OLLIE, "Private");
		const refused = await patchAs(EVE, `/collections/${id}`, {
			mockProjectId: foreign,
		});
		expect(refused.status).toBe(400);
		expect(refused.body.error.code).toBe("INVALID_MOCK_PROJECT");
		const cleared = await patchAs(EVE, `/collections/${id}`, {
			mockProjectId: null,
		});
		expect(cleared.body.mockProject).toBeNull();
	});

	it("refuses an environment of the workspace the caller cannot open, like a missing one", async () => {
		const { ws, id } = await linkedShop();
		await as(ADA).send("post", `/elements/collection/${id}/shares`, {
			usernameOrEmail: "ollie",
			role: "editor",
		});
		const hidden = await createEnvironmentAs(ADA, ws, { name: "Prod" });
		const path = `/collections/${id}`;
		const unreadable = await patchAs(OLLIE, path, {
			linkedEnvironmentId: hidden.id,
		});
		const missing = await patchAs(OLLIE, path, {
			linkedEnvironmentId: "0".repeat(24),
		});
		expect(unreadable.status).toBe(400);
		expect(unreadable.body).toEqual(missing.body);
		expect(unreadable.body.error.code).toBe("INVALID_ENVIRONMENT_LINK");
	});
});
