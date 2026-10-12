import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ADA, EVE, OLLIE, VIC } from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

describe("globals", () => {
	it("let Admins and Editors change shared values and every member set local ones", async () => {
		const ws = (await teamOfThree()).toHexString();
		const empty = await as(VIC).get(`/workspaces/${ws}/globals`);
		expect(empty.body).toMatchObject({
			role: "viewer",
			variables: [],
			localValues: [],
			updatedAt: null,
		});
		const set = await as(EVE).send("put", `/workspaces/${ws}/globals`, {
			variables: [
				variableInput("region", "eu"),
				variableInput("apiKey", "k-123", { type: "secret" }),
			],
		});
		expect(set.status, JSON.stringify(set.body)).toBe(200);
		expect(set.body.role).toBe("editor");
		const denied = await as(VIC).send("put", `/workspaces/${ws}/globals`, {
			variables: [],
		});
		expect(denied.status).toBe(403);
		const local = await as(VIC).send(
			"patch",
			`/workspaces/${ws}/globals/local-values`,
			{ values: [{ key: "region", value: "us" }] },
		);
		expect(local.body.localValues).toEqual([{ key: "region", value: "us" }]);
		const viewer = await as(VIC).get(`/workspaces/${ws}/globals`);
		expect(viewer.body.variables[1]).toMatchObject({
			key: "apiKey",
			sharedValue: null,
			sharedHidden: true,
		});
		expect(
			(await as(ADA).get(`/workspaces/${ws}/globals`)).body.localValues,
		).toEqual([]);
	});

	it("are hidden from people outside the workspace", async () => {
		const ws = (await teamOfThree()).toHexString();
		expect((await as(OLLIE).get(`/workspaces/${ws}/globals`)).status).toBe(404);
	});
});

describe("active environment", () => {
	it("is each person's own choice within the workspace", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws);
		const url = `/workspaces/${ws}/active-environment`;
		expect((await as(VIC).get(url)).body).toEqual({
			workspaceId: ws,
			environmentId: null,
		});
		const set = await as(VIC).send("put", url, { environmentId: env.id });
		expect(set.body.environmentId).toBe(env.id);
		expect((await as(VIC).get(url)).body.environmentId).toBe(env.id);
		expect((await as(EVE).get(url)).body.environmentId).toBeNull();
		await as(VIC).send("put", url, { environmentId: null });
		expect((await as(VIC).get(url)).body.environmentId).toBeNull();
	});

	it("refuses an environment of another workspace and forgets a deleted one", async () => {
		const ws = (await teamOfThree()).toHexString();
		const other = (await teamOfThree("Other")).toHexString();
		const elsewhere = await createEnvironmentAs(EVE, other);
		const url = `/workspaces/${ws}/active-environment`;
		const wrong = await as(EVE).send("put", url, {
			environmentId: elsewhere.id,
		});
		expect(wrong.status).toBe(409);
		expect(wrong.body.error.code).toBe("ENVIRONMENT_NOT_IN_WORKSPACE");
		const env = await createEnvironmentAs(EVE, ws);
		await as(EVE).send("put", url, { environmentId: env.id });
		await as(EVE).send("delete", `/environments/${env.id}`);
		expect((await as(EVE).get(url)).body.environmentId).toBeNull();
	});
});

describe("collection local values", () => {
	it("belong to the caller and are open to any role on the collection", async () => {
		registerCollectionAdapter();
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(ADA, ws, { name: "Orders" });
		const url = `/collections/${id}/local-values`;
		const set = await as(VIC).send("patch", url, {
			values: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		expect(set.status, JSON.stringify(set.body)).toBe(200);
		expect((await as(VIC).get(url)).body.localValues).toEqual([
			{ key: "baseUrl", value: "http://localhost:3000" },
		]);
		expect((await as(ADA).get(url)).body.localValues).toEqual([]);
		expect((await as(OLLIE).get(url)).status).toBe(404);
	});
});
