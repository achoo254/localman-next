import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { LocalVariableValueModel } from "../environments/local-variable-value-model.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { getSecretVaultOperation } from "./secret-vault-operations.js";
import {
	createVaultAs,
	fakeCiphertext,
	useSecretVaultOn,
	vaultParams,
} from "./testing/vault-fixture.js";

useEnvironmentTestDb();
useSecretVaultOn();

const VAULT = "/users/me/secret-vault";

describe("secret vault parameters", () => {
	it("starts empty, is created once and read back", async () => {
		expect((await as(EVE).get(VAULT)).body).toEqual({ vault: null });
		const params = vaultParams();
		const created = await as(EVE).send("put", VAULT, params);
		expect(created.status).toBe(200);
		expect((await as(EVE).get(VAULT)).body).toEqual({ vault: params });
		const again = await as(EVE).send("put", VAULT, vaultParams());
		expect(again.status).toBe(409);
		expect(again.body).toMatchObject({
			error: { code: "SECRET_VAULT_EXISTS" },
		});
	});

	it("refuses parameters that are not a vault's", async () => {
		const bad = await as(EVE).send("put", VAULT, {
			...vaultParams(),
			check: "not-a-ciphertext",
		});
		expect(bad.status).toBe(400);
	});

	it("is not for agents: no session, no vault", async () => {
		await expect(
			callAsAgent(getSecretVaultOperation, EVE, {}),
		).rejects.toMatchObject({ status: 401 });
	});

	it("reset drops the vault and only the values it encrypted", async () => {
		const ws = (await teamOfThree()).toHexString();
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [
				variableInput("token", "", { type: "secret" }),
				variableInput("host", "api.test"),
			],
		});
		await createVaultAs(EVE);
		const local = await as(EVE).send(
			"patch",
			`/environments/${env.id}/local-values`,
			{
				values: [
					{ key: "token", value: fakeCiphertext() },
					{ key: "host", value: "local.test" },
				],
			},
		);
		expect(local.status, JSON.stringify(local.body)).toBe(200);
		const preview = await as(EVE).send("delete", `${VAULT}?dryRun=true`);
		expect(preview.body).toEqual({ deletedValues: 1, dryRun: true });
		const reset = await as(EVE).send("delete", VAULT);
		expect(reset.body).toEqual({ deletedValues: 1, dryRun: false });
		expect((await as(EVE).get(VAULT)).body).toEqual({ vault: null });
		const left = await LocalVariableValueModel.find({ userId: EVE }).lean();
		expect(left.map((row) => row.key)).toEqual(["host"]);
	});

	it("reset also drops a ciphertext saved before its name was a secret", async () => {
		const ws = (await teamOfThree()).toHexString();
		// "apiKey" was flagged secret in a draft not saved yet: the browser
		// sealed its value, the server stored it unmarked.
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Staging",
			variables: [variableInput("apiKey", ""), variableInput("host", "")],
		});
		await createVaultAs(EVE);
		const local = await as(EVE).send(
			"patch",
			`/environments/${env.id}/local-values`,
			{
				values: [
					{ key: "apiKey", value: fakeCiphertext() },
					{ key: "host", value: "local.test" },
				],
			},
		);
		expect(local.status, JSON.stringify(local.body)).toBe(200);
		const preview = await as(EVE).send("delete", `${VAULT}?dryRun=true`);
		expect(preview.body).toEqual({ deletedValues: 1, dryRun: true });
		await as(EVE).send("delete", VAULT).expect(200);
		const left = await LocalVariableValueModel.find({ userId: EVE }).lean();
		expect(left.map((row) => row.key)).toEqual(["host"]);
	});
});
