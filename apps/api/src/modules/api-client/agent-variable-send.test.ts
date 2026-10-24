import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { EVE } from "../access/testing/access-fixture.js";
import { teamOfThree } from "../collections/testing/collection-fixture.js";
import { callAsAgent } from "../environments/testing/agent-caller.js";
import {
	createEnvironmentAs,
	useEnvironmentTestDb,
	variableInput,
} from "../environments/testing/environment-fixture.js";
import { configureSecretVault } from "../secret-vault/secret-vault-gate.js";
import {
	createVaultAs,
	fakeCiphertext,
	useSecretVaultOn,
} from "../secret-vault/testing/vault-fixture.js";
import { createProxyOperations } from "./proxy-operations.js";
import {
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "./proxy-test-server.js";

const server = useTestServer();
useEnvironmentTestDb();
useSecretVaultOn();

const [sendRequest] = createProxyOperations({
	guard: testGuard(),
	logger: () => createLogger("silent"),
	routeLocal: async (_sub, _session, url) => ({ url, tunnel: null }),
});

const SHARED = "shared-s3cret-91ab";
const COPY = "agent-copy-s3cret-5d2e";

/** Eve lets her agents use `token` of an environment, toward the test server. */
async function letAgentsUse(env: string): Promise<void> {
	const res = await as(EVE).send(
		"put",
		`/agent-secret-uses/environment/${env}/token`,
		{ hosts: ["127.0.0.1"] },
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/**
 * Eve's workspace with an environment: `base` (plain) and secret `token`,
 * which her agents may use toward the test server.
 */
async function workspace() {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("base", server.origin),
			variableInput("token", SHARED, { type: "secret" }),
		],
	});
	await letAgentsUse(env.id);
	return { ws, env: env.id };
}

function send(ws: string, env: string, extra: object = {}) {
	if (!sendRequest) throw new Error("no send operation");
	return callAsAgent(sendRequest, EVE, {
		method: "GET",
		url: "{{base}}/echo?t={{token}}",
		headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
		variables: { workspaceId: ws, environmentId: env },
		...extra,
	}) as Promise<{ status: number; body: string; finalUrl: string }>;
}

describe("send_request filling variables for an agent", () => {
	it("sends the secret and never shows it back", async () => {
		const { ws, env } = await workspace();
		const res = await send(ws, env);
		expect(res.status).toBe(200);
		expect(JSON.stringify(res)).not.toContain(SHARED);
		const echo = echoOf(res.body);
		expect(headerValues(echo, "authorization")).toEqual(["Bearer [secret]"]);
		expect(echo.path).toBe("/echo?t=[secret]");
		expect(res.finalUrl).toBe(`${server.origin}/echo?t=[secret]`);
	});

	it("leaves an unknown name as typed", async () => {
		const { ws, env } = await workspace();
		const res = await send(ws, env, {
			headers: [{ name: "X-Other", value: "{{missing}}" }],
		});
		expect(headerValues(echoOf(res.body), "x-other")).toEqual(["{{missing}}"]);
	});

	it("stops on a vault value the user did not let agents use", async () => {
		const { ws, env } = await workspace();
		await createVaultAs(EVE);
		const path = `/environments/${env}/local-values`;
		await as(EVE).send("patch", path, {
			values: [{ key: "token", value: fakeCiphertext() }],
		});
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 409,
			code: "SECRET_WITHHELD",
			details: { keys: "token", vault: "token" },
		});
		await as(EVE).send("patch", path, {
			values: [{ key: "token", value: fakeCiphertext(), agentValue: COPY }],
		});
		const res = await send(ws, env);
		expect(res.status).toBe(200);
		expect(JSON.stringify(res)).not.toContain(COPY);
		expect(headerValues(echoOf(res.body), "authorization")).toEqual([
			"Bearer [secret]",
		]);
	});

	it("never shows a copy once its variable stops being a secret", async () => {
		const { ws, env } = await workspace();
		await createVaultAs(EVE);
		await as(EVE).send("patch", `/environments/${env}/local-values`, {
			values: [{ key: "token", value: fakeCiphertext(), agentValue: COPY }],
		});
		const retyped = await as(EVE).send(
			"put",
			`/environments/${env}/variables`,
			{
				variables: [
					variableInput("base", server.origin),
					variableInput("token", "", { type: "default" }),
				],
			},
		);
		expect(retyped.status, JSON.stringify(retyped.body)).toBe(200);
		const outcome = await send(ws, env).catch((error: unknown) => error);
		expect(JSON.stringify(outcome)).not.toContain(COPY);
		expect(outcome).toMatchObject({ status: 409, code: "SECRET_WITHHELD" });
	});

	it("does not use a secret's local value saved before the vault", async () => {
		const { ws, env } = await workspace();
		configureSecretVault(false);
		await as(EVE).send("patch", `/environments/${env}/local-values`, {
			values: [{ key: "token", value: "legacy-local-s3cret" }],
		});
		configureSecretVault(true);
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 409,
			details: { vault: "token" },
		});
	});

	it("masks the secret in the URL the server encoded", async () => {
		const ws = (await teamOfThree()).toHexString();
		const spaced = "s3cret with spaces é";
		const env = await createEnvironmentAs(EVE, ws, {
			name: "Encoded",
			variables: [
				variableInput("base", server.origin),
				variableInput("token", spaced, { type: "secret" }),
			],
		});
		await letAgentsUse(env.id);
		const res = await send(ws, env.id);
		expect(res.finalUrl).toBe(`${server.origin}/echo?t=[secret]`);
		expect(echoOf(res.body).path).toBe("/echo?t=[secret]");
	});

	it("is not offered while the vault is off", async () => {
		const { ws, env } = await workspace();
		configureSecretVault(false);
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 404,
			code: "SECRET_VAULT_DISABLED",
		});
	});
});
