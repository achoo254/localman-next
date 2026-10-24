import { beforeEach, describe, expect, it } from "vitest";
import {
	configureRuntime,
	runtimeSettings,
} from "../../config/runtime-settings.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { registerCollectionAdapter } from "../collections/collection-adapter.js";
import {
	createAs,
	teamOfThree,
} from "../collections/testing/collection-fixture.js";
import { setEnvironmentLocalValuesOperation } from "../environments/environment-change-operations.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
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

/** Eve's environment with a secret `token` and a plain `host`. */
async function environment(): Promise<string> {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("token", "", { type: "secret" }),
			variableInput("host", "api.test"),
		],
	});
	return env.id;
}

const patch = (id: string, values: object[]) =>
	as(EVE).send("patch", `/environments/${id}/local-values`, { values });

describe("local values of secret variables with the vault on", () => {
	it("takes only ciphertext, and only once the user has a vault", async () => {
		const id = await environment();
		const cipher = fakeCiphertext();
		const noVault = await patch(id, [{ key: "token", value: cipher }]);
		expect(noVault.status).toBe(409);
		expect(noVault.body).toMatchObject({
			error: { code: "SECRET_VAULT_REQUIRED", details: { keys: "token" } },
		});
		await createVaultAs(EVE);
		const plain = await patch(id, [{ key: "token", value: "plain-s3cret" }]);
		expect(plain.status).toBe(409);
		const ok = await patch(id, [
			{ key: "token", value: cipher },
			{ key: "host", value: "local.test" },
		]);
		expect(ok.status, JSON.stringify(ok.body)).toBe(200);
		expect(ok.body).toEqual({
			localValues: [
				{ key: "token", value: cipher },
				{ key: "host", value: "local.test" },
			],
		});
	});

	it("never lets an agent write one, while plain values still go", async () => {
		const id = await environment();
		await createVaultAs(EVE);
		await expect(
			callAsAgent(setEnvironmentLocalValuesOperation, EVE, {
				environmentId: id,
				values: [{ key: "token", value: fakeCiphertext() }],
			}),
		).rejects.toMatchObject({ status: 403, code: "SECRET_VAULT_AGENT_WRITE" });
		const plain = await callAsAgent(setEnvironmentLocalValuesOperation, EVE, {
			environmentId: id,
			values: [{ key: "host", value: "agent.test" }],
		});
		expect(plain).toEqual({
			localValues: [{ key: "host", value: "agent.test" }],
		});
	});

	it("keeps a copy for agents until a new value comes without it", async () => {
		const id = await environment();
		await createVaultAs(EVE);
		const on = await patch(id, [
			{ key: "token", value: fakeCiphertext(), agentValue: "agent-s3cret" },
		]);
		expect(on.status, JSON.stringify(on.body)).toBe(200);
		expect(JSON.stringify(on.body)).not.toContain("agent-s3cret");
		expect(on.body).toMatchObject({
			localValues: [{ key: "token", agentUse: true }],
		});
		const agentRead = await callAsAgent(
			setEnvironmentLocalValuesOperation,
			EVE,
			{
				environmentId: id,
				values: [],
			},
		);
		expect(agentRead).toEqual({
			localValues: [
				{ key: "token", value: null, hidden: true, agentUse: true },
			],
		});
		const next = await patch(id, [{ key: "token", value: fakeCiphertext() }]);
		expect(next.body).toMatchObject({ localValues: [{ key: "token" }] });
		expect(JSON.stringify(next.body)).not.toContain("agentUse");
	});

	it("refuses a copy for agents of a value that is not in the vault", async () => {
		const id = await environment();
		await createVaultAs(EVE);
		const res = await patch(id, [
			{ key: "host", value: "local.test", agentValue: "local.test" },
		]);
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({
			error: { code: "SECRET_VAULT_AGENT_COPY_INVALID" },
		});
	});

	it("treats a collection variable flagged secret as a vault name", async () => {
		const ws = (await teamOfThree()).toHexString();
		const { id } = await createAs(EVE, ws);
		await as(EVE).send("patch", `/collections/${id}`, {
			variables: [{ key: "token", value: "", secret: true }],
		});
		await createVaultAs(EVE);
		const plain = await as(EVE).send(
			"patch",
			`/collections/${id}/local-values`,
			{
				values: [{ key: "token", value: "plain-s3cret" }],
			},
		);
		expect(plain.status).toBe(409);
	});
});

describe("local values with the vault off", () => {
	it("saves them as before and refuses copies for agents", async () => {
		configureRuntime({ ...runtimeSettings(), secretVault: false });
		const id = await environment();
		const plain = await patch(id, [{ key: "token", value: "plain-s3cret" }]);
		expect(plain.status).toBe(200);
		const copy = await patch(id, [
			{ key: "token", value: fakeCiphertext(), agentValue: "x" },
		]);
		expect(copy.status).toBe(404);
		expect(copy.body).toMatchObject({
			error: { code: "SECRET_VAULT_DISABLED" },
		});
	});
});
