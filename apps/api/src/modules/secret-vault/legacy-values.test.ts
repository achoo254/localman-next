import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import { LocalVariableValueModel } from "../environments/local-variable-value-model.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { listLegacyValuesOperation } from "./legacy-values-operations.js";
import { configureSecretVault } from "./secret-vault-gate.js";
import {
	createVaultAs,
	fakeCiphertext,
	useSecretVaultOn,
} from "./testing/vault-fixture.js";

useEnvironmentTestDb();
useSecretVaultOn();
beforeEach(() => {
	registerCollectionAdapter();
});

const PATH = "/users/me/secret-vault/legacy-values";

/**
 * Eve's environment (secret `token`, plain `host`) and collection (secret
 * `key`), with local values saved before the vault (gate off then).
 */
async function legacy() {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("token", "", { type: "secret" }),
			variableInput("host", "api.test"),
		],
	});
	const { id } = await createAs(EVE, ws);
	await as(EVE).send("patch", `/collections/${id}`, {
		variables: [{ key: "key", value: "", secret: true }],
	});
	configureSecretVault(false);
	await as(EVE).send("patch", `/environments/${env.id}/local-values`, {
		values: [
			{ key: "token", value: "old-token" },
			{ key: "host", value: "local.test" },
		],
	});
	await as(EVE).send("patch", `/collections/${id}/local-values`, {
		values: [{ key: "key", value: "old-key" }],
	});
	configureSecretVault(true);
	return { envScope: `environment:${env.id}`, colScope: `collection:${id}` };
}

describe("moving secrets saved before the vault into it", () => {
	it("lists only plain values of secrets, in every scope", async () => {
		const { envScope, colScope } = await legacy();
		const res = await as(EVE).get(PATH);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.more).toBe(false);
		expect(res.body.values).toEqual(
			expect.arrayContaining([
				{ scope: envScope, key: "token", value: "old-token" },
				{ scope: colScope, key: "key", value: "old-key" },
			]),
		);
		expect(res.body.values).toHaveLength(2);
	});

	it("replaces them by ciphertext, never over a newer value", async () => {
		const { envScope, colScope } = await legacy();
		await createVaultAs(EVE);
		const sealed = await as(EVE).send("post", PATH, {
			items: [
				{
					scope: envScope,
					key: "token",
					expected: "old-token",
					value: fakeCiphertext(),
				},
				{
					scope: colScope,
					key: "key",
					expected: "changed-meanwhile",
					value: fakeCiphertext(),
				},
			],
		});
		expect(sealed.body).toEqual({ sealed: 1, skipped: 1 });
		const after = await as(EVE).get(PATH);
		expect(after.body.values).toEqual([
			{ scope: colScope, key: "key", value: "old-key" },
		]);
		const row = await LocalVariableValueModel.findOne({
			userId: EVE,
			key: "token",
		}).lean();
		expect(row?.vault).toBe(true);
	});

	it("needs a vault, and is not for agents", async () => {
		const { envScope } = await legacy();
		const noVault = await as(EVE).send("post", PATH, {
			items: [
				{
					scope: envScope,
					key: "token",
					expected: "old-token",
					value: fakeCiphertext(),
				},
			],
		});
		expect(noVault.status).toBe(409);
		await expect(
			callAsAgent(listLegacyValuesOperation, EVE, {}),
		).rejects.toMatchObject({ status: 401 });
	});
});
