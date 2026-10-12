import type { EnvironmentDetail } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, VIC } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { EnvironmentModel } from "./environment-model.js";
import { LocalVariableValueModel } from "./local-variable-value-model.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	useVariableKeyring,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

/** Eve (Editor) and Vic (Viewer) on one environment of a team workspace. */
async function sharedEnvironment(): Promise<EnvironmentDetail> {
	const ws = (await teamOfThree()).toHexString();
	return createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("baseUrl", "https://staging.test"),
			variableInput("token", "s3cret", { type: "secret" }),
		],
	});
}

const path = (env: EnvironmentDetail, suffix = "") =>
	`/environments/${env.id}${suffix}`;

function variableNamed(env: EnvironmentDetail, key: string) {
	return env.variables.find((variable) => variable.key === key);
}

describe("shared and local values", () => {
	it("shows Editors the shared value of a secret and withholds it from Viewers", async () => {
		const env = await sharedEnvironment();
		const editor = (await as(EVE).get(path(env))).body as EnvironmentDetail;
		expect(variableNamed(editor, "token")).toMatchObject({
			sharedValue: "s3cret",
			sharedHidden: false,
		});
		const viewer = await as(VIC).get(path(env));
		expect(viewer.status).toBe(200);
		expect(variableNamed(viewer.body, "token")).toMatchObject({
			sharedValue: null,
			sharedHidden: true,
			type: "secret",
		});
		expect(JSON.stringify(viewer.body)).not.toContain("s3cret");
		const list = await as(VIC).get(
			`/workspaces/${env.workspaceId}/environments`,
		);
		expect(JSON.stringify(list.body)).not.toContain("s3cret");
	});

	it("stores a secret's shared value encrypted", async () => {
		const env = await sharedEnvironment();
		const stored = await EnvironmentModel.findById(env.id).lean();
		const token = stored?.variables.find((v) => v.key === "token");
		expect(token?.sealed).toBe(true);
		expect(JSON.stringify(stored)).not.toContain("s3cret");
	});

	it("keeps a Viewer's local value to themselves", async () => {
		const env = await sharedEnvironment();
		const set = await as(VIC).send("patch", path(env, "/local-values"), {
			values: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		expect(set.status, JSON.stringify(set.body)).toBe(200);
		expect(set.body.localValues).toEqual([
			{ key: "baseUrl", value: "http://localhost:3000" },
		]);
		expect((await as(VIC).get(path(env))).body.localValues).toHaveLength(1);
		const editor = (await as(EVE).get(path(env))).body as EnvironmentDetail;
		expect(editor.localValues).toEqual([]);
		expect(variableNamed(editor, "baseUrl")?.sharedValue).toBe(
			"https://staging.test",
		);
	});

	it("refuses a Viewer's change to shared values (403)", async () => {
		const env = await sharedEnvironment();
		const res = await as(VIC).send("put", path(env, "/variables"), {
			variables: [variableInput("baseUrl", "https://evil.test")],
		});
		expect(res.status).toBe(403);
		expect((await as(VIC).send("patch", path(env), { name: "x" })).status).toBe(
			403,
		);
	});

	it("resets a local value back to the shared one", async () => {
		const env = await sharedEnvironment();
		await as(VIC).send("patch", path(env, "/local-values"), {
			values: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		const reset = await as(VIC).send("patch", path(env, "/local-values"), {
			values: [{ key: "baseUrl", value: null }],
		});
		expect(reset.body.localValues).toEqual([]);
		expect(await LocalVariableValueModel.countDocuments()).toBe(0);
	});

	it("seals local values of secrets, also when a variable turns secret", async () => {
		const env = await sharedEnvironment();
		await as(VIC).send("patch", path(env, "/local-values"), {
			values: [
				{ key: "token", value: "vic-token" },
				{ key: "baseUrl", value: "http://localhost:3000" },
			],
		});
		const rows = await LocalVariableValueModel.find().lean();
		expect(rows.find((r) => r.key === "token")?.sealed).toBe(true);
		expect(JSON.stringify(rows)).not.toContain("vic-token");
		await as(EVE).send("put", path(env, "/variables"), {
			variables: env.variables.map((variable) => ({
				...variable,
				type: "secret",
			})),
		});
		const after = await LocalVariableValueModel.find().lean();
		expect(after.every((row) => row.sealed)).toBe(true);
		expect((await as(VIC).get(path(env))).body.localValues).toEqual([
			{ key: "token", value: "vic-token" },
			{ key: "baseUrl", value: "http://localhost:3000" },
		]);
	});

	it("keeps variable ids and rejects duplicate names", async () => {
		const env = await sharedEnvironment();
		const base = variableNamed(env, "baseUrl");
		const res = await as(EVE).send("put", path(env, "/variables"), {
			variables: [{ ...base, key: "host", description: "Where to send" }],
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.variables).toEqual([
			expect.objectContaining({ id: base?.id, key: "host" }),
		]);
		const duplicate = await as(EVE).send("put", path(env, "/variables"), {
			variables: [variableInput("a", "1"), variableInput("a", "2")],
		});
		expect(duplicate.status).toBe(400);
	});

	it("answers 503 for a secret value without a keyring, and saves the rest", async () => {
		const env = await sharedEnvironment();
		useVariableKeyring(null);
		const secret = await as(EVE).send("put", path(env, "/variables"), {
			variables: [variableInput("key", "v", { type: "secret" })],
		});
		expect(secret.status).toBe(503);
		expect(secret.body.error.code).toBe("SECRET_STORAGE_UNAVAILABLE");
		const plain = await as(EVE).send("put", path(env, "/variables"), {
			variables: [variableInput("host", "api.test")],
		});
		expect(plain.status).toBe(200);
	});
});
