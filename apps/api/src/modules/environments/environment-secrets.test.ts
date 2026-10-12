import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE, VIC } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { patchLocalValues } from "./local-values.js";
import { LocalVariableValueModel } from "./local-variable-value-model.js";
import {
	createEnvironmentAs,
	testKeyring,
	useEnvironmentTestDb,
	useVariableKeyring,
	variableInput,
} from "./testing/environment-fixture.js";

useEnvironmentTestDb();

describe("secrets the server cannot open", () => {
	it("read as hidden to Editors and survive a save until the key returns", async () => {
		const keyring = testKeyring();
		useVariableKeyring(keyring);
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [variableInput("token", "s3cret", { type: "secret" })],
		});
		const token = env.variables[0];
		useVariableKeyring(testKeyring("other"));
		const hidden = await as(EVE).get(`/environments/${env.id}`);
		expect(hidden.body.variables[0]).toMatchObject({
			sharedValue: null,
			sharedHidden: true,
		});
		const saved = await as(EVE).send(
			"put",
			`/environments/${env.id}/variables`,
			{
				variables: [{ ...token, sharedValue: null, description: "kept" }],
			},
		);
		expect(saved.status, JSON.stringify(saved.body)).toBe(200);
		useVariableKeyring(keyring);
		const back = await as(EVE).get(`/environments/${env.id}`);
		expect(back.body.variables[0]).toMatchObject({
			sharedValue: "s3cret",
			description: "kept",
		});
	});
});

describe("local values written while a variable changes", () => {
	const scope = "environment:0123456789abcdef01234567";

	it("are sealed when the variable turned secret during the write", async () => {
		const states = [new Set<string>(), new Set(["token"])];
		let call = 0;
		await patchLocalValues(
			VIC,
			scope,
			[{ key: "token", value: "vic" }],
			async () => ({
				exists: true,
				secretKeys: states[Math.min(call++, 1)] ?? new Set(),
			}),
		);
		const row = await LocalVariableValueModel.findOne({ key: "token" }).lean();
		expect(row?.sealed).toBe(true);
		expect(row?.value).not.toContain("vic");
	});

	it("are removed again when the scope was deleted during the write", async () => {
		let call = 0;
		await expect(
			patchLocalValues(VIC, scope, [{ key: "a", value: "1" }], async () => ({
				exists: call++ === 0,
				secretKeys: new Set<string>(),
			})),
		).rejects.toMatchObject({ status: 404 });
		expect(await LocalVariableValueModel.countDocuments()).toBe(0);
	});
});

describe("variable lists", () => {
	it("refuse two variables with the same id", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [variableInput("a", "1")],
		});
		const id = env.variables[0]?.id;
		const res = await as(EVE).send("put", `/environments/${env.id}/variables`, {
			variables: [
				variableInput("a", "1", { id }),
				variableInput("b", "2", { id }),
			],
		});
		expect(res.status).toBe(400);
	});
});
