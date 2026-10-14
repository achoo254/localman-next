import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	personalWorkspace,
	teamWorkspace,
} from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import { CollectionModel } from "../collections/collection-model.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { RunButtonModel } from "./run-button-model.js";
import {
	SENSITIVE_TREE,
	expectNoSecrets,
	setSharing,
} from "./testing/public-sharing-fixture.js";

useEnvironmentTestDb();
beforeEach(() => registerCollectionAdapter());

const SCRIPTED = {
	...SENSITIVE_TREE,
	scripts: { pre: "pm.environment.set('x', 1)", post: "" },
};

async function setup(visibility: "team" | "public") {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(EVE, ws, { tree: SCRIPTED });
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("host", "https://staging.test"),
			variableInput("token", "env-secret", { type: "secret" }),
			variableInput("mine", null),
		],
	});
	const res = await as(EVE).send("post", `/collections/${id}/run-buttons`, {
		visibility,
		environmentId: env.id,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	const url: string = res.body.button.url;
	return {
		ws,
		id,
		envId: env.id,
		buttonId: url.slice(url.lastIndexOf("/") + 1),
	};
}

const preview = (sub: string, buttonId: string) =>
	as(sub).send("post", "/run-buttons/preview", { buttonId });

const importAs = (sub: string, body: object) =>
	as(sub).send("post", "/run-buttons/import", {
		includeScripts: false,
		idempotencyKey: "key-12345678",
		...body,
	});

describe("Run buttons", () => {
	it("import the redacted collection without scripts, with shared plain variables", async () => {
		const { buttonId } = await setup("public");
		const shown = await preview(OLLIE, buttonId);
		expect(shown.status, JSON.stringify(shown.body)).toBe(200);
		expect(shown.body).toMatchObject({
			name: "Payments",
			requestCount: 1,
			visibility: "public",
			environmentName: "Staging",
			scripts: [{ path: [], phase: "pre" }],
		});
		const target = (await personalWorkspace(OLLIE)).toHexString();
		const done = await importAs(OLLIE, { buttonId, workspaceId: target });
		expect(done.status, JSON.stringify(done.body)).toBe(200);
		expect(done.body.environmentError).toBeNull();
		const created = await as(OLLIE).get(
			`/collections/${done.body.collectionId}`,
		);
		expect(created.body.workspaceId).toBe(target);
		expect(created.body.scripts).toEqual({ pre: "", post: "" });
		expectNoSecrets(created.body);
		const env = await as(OLLIE).get(`/environments/${done.body.environmentId}`);
		expect(env.body.variables.map((v: { key: string }) => v.key)).toEqual([
			"host",
		]);
		expect(JSON.stringify(env.body)).not.toContain("env-secret");
	});

	it("create one collection when the same import is sent twice", async () => {
		const { buttonId } = await setup("public");
		const target = (await personalWorkspace(OLLIE)).toHexString();
		const body = { buttonId, workspaceId: target };
		const [first, second] = await Promise.all([
			importAs(OLLIE, body),
			importAs(OLLIE, body),
		]);
		const statuses = [first.status, second.status].sort();
		expect(statuses[0]).toBe(200);
		const third = await importAs(OLLIE, body);
		expect(third.body.collectionId).toBe(
			first.body.collectionId ?? second.body.collectionId,
		);
		const ids = new Types.ObjectId(target);
		expect(await CollectionModel.countDocuments({ workspaceId: ids })).toBe(1);
	});

	it("refuse an idempotency key reused for another workspace", async () => {
		const { buttonId } = await setup("public");
		const personal = (await personalWorkspace(OLLIE)).toHexString();
		expect(
			(await importAs(OLLIE, { buttonId, workspaceId: personal })).status,
		).toBe(200);
		const other = (
			await teamWorkspace({ [OLLIE]: "admin" }, "O")
		).toHexString();
		const reused = await importAs(OLLIE, { buttonId, workspaceId: other });
		expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
	});

	it("keep team buttons to the workspace's members", async () => {
		const { buttonId } = await setup("team");
		expect((await preview(OLLIE, buttonId)).status).toBe(404);
		expect((await preview(VIC, buttonId)).status).toBe(200);
		const viewerTarget = await importAs(VIC, {
			buttonId,
			workspaceId: (await teamOfThree("Other")).toHexString(),
		});
		expect(viewerTarget.status).toBe(403);
	});

	it("stop with the source: trash, public links off, unknown id", async () => {
		const { ws, id, buttonId } = await setup("public");
		expect((await preview(OLLIE, "nope")).status).toBe(404);
		await setSharing(ws, { publicLinksAllowed: false });
		const off = await preview(OLLIE, buttonId);
		expect(off.body.error.code).toBe("RUN_BUTTON_NOT_FOUND");
		await setSharing(ws, { publicLinksAllowed: true });
		await CollectionModel.updateOne(
			{ _id: new Types.ObjectId(id) },
			{ deletedAt: new Date(), deletedBy: EVE },
		);
		expect((await preview(OLLIE, buttonId)).status).toBe(404);
	});

	it("are created only by Admin and Editor members, with an environment of the workspace", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws, { tree: SENSITIVE_TREE });
		const path = `/collections/${id}/run-buttons`;
		expect(
			(await as(VIC).send("post", path, { visibility: "team" })).status,
		).toBe(403);
		const elsewhere = (
			await teamWorkspace({ [ADA]: "admin", [EVE]: "viewer" }, "B")
		).toHexString();
		const foreign = await createEnvironmentAs(ADA, elsewhere, {
			name: "B env",
		});
		const viewerEnv = await as(EVE).send("post", path, {
			visibility: "team",
			environmentId: foreign.id,
		});
		expect(viewerEnv.status).toBe(403);
		const adaEnv = await as(ADA).send("post", path, {
			visibility: "team",
			environmentId: foreign.id,
		});
		expect(adaEnv.body.error.code).toBe("ENVIRONMENT_NOT_IN_WORKSPACE");
	});

	it("go away with their environment and can be deleted", async () => {
		const { id, envId } = await setup("team");
		await setup("team");
		expect(await RunButtonModel.countDocuments()).toBe(2);
		const del = await as(EVE).send("delete", `/environments/${envId}`, {
			confirm: "delete",
		});
		expect(del.status, JSON.stringify(del.body)).toBe(200);
		expect(await RunButtonModel.countDocuments()).toBe(1);
		const { id: otherId } = await setup("team");
		const [button] = (await as(EVE).get(`/collections/${otherId}/run-buttons`))
			.body.items;
		const path = `/collections/${otherId}/run-buttons/${button.id}`;
		expect((await as(VIC).send("delete", path)).status).toBe(403);
		expect((await as(EVE).send("delete", path)).body.deleted).toBe(true);
		expect(id).not.toBe(otherId);
	});
});
