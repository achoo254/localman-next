import type { EnvironmentDetail } from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	ADA,
	EVE,
	VIC,
	personalWorkspace,
} from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { setEnvironmentVariables } from "../environments/environment-service.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { UserModel } from "../users/user-model.js";

useEnvironmentTestDb();

beforeEach(async () => {
	await UserModel.updateMany(
		{},
		{ $set: { plan: "pro", planExpiresAt: null } },
	);
});

const sharedOf = (env: EnvironmentDetail, key: string) =>
	env.variables.find((variable) => variable.key === key)?.sharedValue;
const read = async (sub: string, id: string) =>
	(await as(sub).get(`/environments/${id}`)).body as EnvironmentDetail;

/** Writes the variables of `id` as `sub`, keeping the others by id. */
async function setVariables(
	sub: string,
	id: string,
	changes: Record<string, string>,
	added: object[] = [],
) {
	const env = await read(sub, id);
	const variables = env.variables.map((variable) => ({
		id: variable.id,
		key: variable.key,
		type: variable.type,
		enabled: variable.enabled,
		description: variable.description,
		sharedValue: changes[variable.key] ?? variable.sharedValue,
	}));
	const res = await as(sub).send("put", `/environments/${id}/variables`, {
		variables: [...variables, ...added],
	});
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}

async function forkedEnv() {
	const ws = (await teamOfThree()).toHexString();
	const source = await createEnvironmentAs(ADA, ws, {
		name: "Staging",
		variables: [
			variableInput("baseUrl", "https://a.test"),
			variableInput("token", "s3cret", { type: "secret" }),
		],
	});
	const res = await as(EVE).send("post", `/environments/${source.id}/forks`, {
		label: "eve",
		workspaceId: ws,
	});
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return { ws, source: source.id, fork: (res.body as EnvironmentDetail).id };
}

describe("environment forks", () => {
	it("copy a secret's value for Editors of the source only", async () => {
		const { source, fork } = await forkedEnv();
		expect(sharedOf(await read(EVE, fork), "token")).toBe("s3cret");
		const own = (await personalWorkspace(VIC)).toHexString();
		const res = await as(VIC).send("post", `/environments/${source}/forks`, {
			label: "vic",
			workspaceId: own,
		});
		expect(res.status).toBe(201);
		expect(sharedOf(res.body as EnvironmentDetail, "token")).toBeNull();
	});

	it("pull and merge plain values by key, never secret values", async () => {
		const { source, fork } = await forkedEnv();
		await setVariables(ADA, source, { baseUrl: "https://b.test" });
		await setVariables(EVE, fork, { token: "fork-secret" }, [
			variableInput("debug", "1"),
		]);
		const pull = await as(EVE).send("post", `/environments/${fork}/pull`, {});
		expect(pull.status, JSON.stringify(pull.body)).toBe(200);
		const pulled = await read(EVE, fork);
		expect(sharedOf(pulled, "baseUrl")).toBe("https://b.test");
		expect(sharedOf(pulled, "token")).toBe("fork-secret");
		expect(sharedOf(pulled, "debug")).toBe("1");
		const preview = await as(ADA).get(`/environments/${fork}/merge`);
		expect(preview.body.changes).toEqual([
			{ kind: "added", entityKind: "variable", name: "debug" },
		]);
		expect(
			(await as(ADA).send("post", `/environments/${fork}/merge`, {})).status,
		).toBe(200);
		const merged = await read(ADA, source);
		expect(sharedOf(merged, "debug")).toBe("1");
		expect(sharedOf(merged, "token")).toBe("s3cret");
	});

	it("reports the same variable changed both ways", async () => {
		const { source, fork } = await forkedEnv();
		await setVariables(ADA, source, { baseUrl: "https://s.test" });
		await setVariables(EVE, fork, { baseUrl: "https://f.test" });
		const preview = await as(EVE).get(`/environments/${fork}/pull`);
		expect(preview.body.conflicts).toMatchObject([
			{ id: "baseUrl:value", entityKind: "variable", name: "baseUrl" },
		]);
		const done = await as(EVE).send("post", `/environments/${fork}/pull`, {
			resolutions: { "baseUrl:value": "source" },
		});
		expect(done.status).toBe(200);
		expect(sharedOf(await read(EVE, fork), "baseUrl")).toBe("https://s.test");
	});

	it("merge variables named like built-in object properties", async () => {
		const { source, fork } = await forkedEnv();
		await setVariables(EVE, fork, {}, [
			variableInput("constructor", "c"),
			variableInput("__proto__", "p"),
		]);
		const res = await as(ADA).send("post", `/environments/${fork}/merge`, {});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const merged = await read(ADA, source);
		expect(sharedOf(merged, "constructor")).toBe("c");
		expect(sharedOf(merged, "__proto__")).toBe("p");
	});

	it("refuse to write over a change made since it was read", async () => {
		const { source } = await forkedEnv();
		await expect(
			setEnvironmentVariables(ADA, source, [], { ifUpdatedAt: new Date(0) }),
		).rejects.toMatchObject({ status: 409, code: "ENVIRONMENT_CHANGED" });
		expect((await read(ADA, source)).variables).toHaveLength(2);
	});
});
