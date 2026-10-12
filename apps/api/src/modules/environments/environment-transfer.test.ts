import type {
	EnvironmentDetail,
	PostmanEnvironmentFile,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, OLLIE, VIC } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { EnvironmentModel } from "./environment-model.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

/** A value as a Postman file holds it. */
const value = (key: string, v: string, type = "default", enabled = true) => ({
	key,
	value: v,
	type,
	enabled,
});

/** Shaped like a file Postman writes from "Export" on an environment. */
const POSTMAN_FILE = {
	id: "5f0c7c3a-9d2e-4a61-8f3b-2a1d6e9b7c40",
	name: "Staging",
	values: [
		value("baseUrl", "https://stg.example"),
		value("apiKey", "sk_live_123", "secret"),
		value("oldHost", "http://old.example", "text", false),
	],
	_postman_variable_scope: "environment",
	_postman_exported_at: "2026-09-30T08:15:42.117Z",
	_postman_exported_using: "Postman/11.14.0",
};

/** Each variable as `[key, type, enabled, sharedValue]`. */
const brief = (env: EnvironmentDetail) =>
	env.variables.map((v) => [v.key, v.type, v.enabled, v.sharedValue]);

const importPath = (ws: string) => `/workspaces/${ws}/environments/import`;

async function importAs(sub: string, ws: string, body: object) {
	return as(sub).send("post", importPath(ws), body);
}

const exportOf = async (sub: string, id: string) =>
	as(sub).get(`/environments/${id}/export`);

describe("environment export", () => {
	it("gives any role the Postman file with shared values only", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Prod/EU",
			variables: [
				variableInput("baseUrl", "https://api.example.com"),
				variableInput("token", "s3cret", { type: "secret" }),
				variableInput("mine", null),
				variableInput("off", "1", { enabled: false }),
			],
		});
		await as(EVE).send("patch", `/environments/${env.id}/local-values`, {
			values: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		for (const sub of [VIC, EVE]) {
			const res = await exportOf(sub, env.id);
			expect(res.status, JSON.stringify(res.body)).toBe(200);
			expect(res.body.fileName).toBe("Prod_EU.postman_environment.json");
			const file = res.body.environment as PostmanEnvironmentFile;
			expect(file).toMatchObject({
				id: env.id,
				name: "Prod/EU",
				_postman_variable_scope: "environment",
				_postman_exported_using: "Localman",
			});
			expect(file.values).toEqual([
				{
					key: "baseUrl",
					value: "https://api.example.com",
					type: "default",
					enabled: true,
				},
				{ key: "token", value: "", type: "secret", enabled: true },
				{ key: "mine", value: "", type: "default", enabled: true },
				{ key: "off", value: "1", type: "default", enabled: false },
			]);
			expect(JSON.stringify(res.body)).not.toContain("s3cret");
			expect(JSON.stringify(res.body)).not.toContain("localhost");
		}
		expect((await exportOf(OLLIE, env.id)).status).toBe(404);
	});
});

describe("environment import", () => {
	it("creates the environment for an Editor, sealing secret values", async () => {
		const ws = (await teamOfThree()).toHexString();
		const res = await importAs(EVE, ws, { environment: POSTMAN_FILE });
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		const env = res.body as EnvironmentDetail;
		expect(env).toMatchObject({ name: "Staging", role: "editor" });
		expect(brief(env)).toEqual([
			["baseUrl", "default", true, "https://stg.example"],
			["apiKey", "secret", true, "sk_live_123"],
			["oldHost", "default", false, "http://old.example"],
		]);
		const stored = await EnvironmentModel.findById(env.id).lean();
		const apiKey = stored?.variables.find((v) => v.key === "apiKey");
		expect(apiKey?.sealed).toBe(true);
		expect(JSON.stringify(stored)).not.toContain("sk_live_123");
	});

	it("takes `name` over the file's name", async () => {
		const ws = (await teamOfThree()).toHexString();
		const res = await importAs(EVE, ws, {
			environment: { values: [] },
			name: "Renamed",
		});
		expect(res.status).toBe(201);
		expect(res.body.name).toBe("Renamed");
	});

	it("refuses Viewers (403) and outsiders (404) before reading the file", async () => {
		const ws = (await teamOfThree()).toHexString();
		expect(
			(await importAs(VIC, ws, { environment: POSTMAN_FILE })).status,
		).toBe(403);
		expect((await importAs(VIC, ws, { environment: "junk" })).status).toBe(403);
		expect(
			(await importAs(OLLIE, ws, { environment: POSTMAN_FILE })).status,
		).toBe(404);
	});

	it.each([
		["not an environment", { environment: [1, 2] }, "not_an_environment"],
		[
			"a duplicate name",
			{ environment: { name: "x", values: [{ key: "a" }, { key: "a" }] } },
			"duplicate_key",
		],
		["no name at all", { environment: { values: [] } }, "missing_name"],
	])(
		"answers 400 INVALID_ENVIRONMENT_FILE for %s",
		async (_label, body, issue) => {
			const ws = (await teamOfThree()).toHexString();
			const res = await importAs(EVE, ws, body);
			expect(res.status).toBe(400);
			expect(res.body.error).toMatchObject({
				code: "INVALID_ENVIRONMENT_FILE",
				details: { issue },
			});
			expect(res.body.error.message).toMatch(/\S/);
		},
	);

	it("round-trips an export: keys, types, enabled, shared and unshared values", async () => {
		const ws = (await teamOfThree()).toHexString();
		const source = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [
				variableInput("baseUrl", "https://api.example.com"),
				variableInput("token", "s3cret", { type: "secret" }),
				variableInput("off", "1", { enabled: false }),
				// Exported as "" and imported back as still not shared.
				variableInput("unshared", null),
			],
		});
		const exported = await exportOf(EVE, source.id);
		const res = await importAs(EVE, ws, {
			environment: exported.body.environment,
			name: "Staging copy",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(201);
		const back = res.body as EnvironmentDetail;
		const blankSecrets = brief(source).map((row) =>
			row[1] === "secret" ? [row[0], row[1], row[2], null] : row,
		);
		expect(brief(back)).toEqual(blankSecrets);
	});
});
