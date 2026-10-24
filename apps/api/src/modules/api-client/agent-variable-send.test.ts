import { describe, expect, it } from "vitest";
import {
	configureRuntime,
	runtimeSettings,
} from "../../config/runtime-settings.js";
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

/** Eve's workspace with an environment: `base` (plain) and secret `token`. */
async function workspace() {
	const ws = (await teamOfThree()).toHexString();
	const env = await createEnvironmentAs(EVE, ws, {
		name: "Staging",
		variables: [
			variableInput("base", server.origin),
			variableInput("token", SHARED, { type: "secret" }),
		],
	});
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

	it("is not offered while the vault is off", async () => {
		const { ws, env } = await workspace();
		configureRuntime({ ...runtimeSettings(), secretVault: false });
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 404,
			code: "SECRET_VAULT_DISABLED",
		});
	});
});
