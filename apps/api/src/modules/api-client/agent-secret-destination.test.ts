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
import { setAgentSecretUseOperation } from "../secret-vault/agent-secret-use-operations.js";
import { useSecretVaultOn } from "../secret-vault/testing/vault-fixture.js";
import { createProxyOperations } from "./proxy-operations.js";
import { testGuard, useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
useEnvironmentTestDb();
useSecretVaultOn();

const [sendRequest] = createProxyOperations({
	guard: testGuard(),
	logger: () => createLogger("silent"),
	routeLocal: async (_sub, _session, url) => ({ url, tunnel: null }),
});

const SHARED = "shared-s3cret-77c4";

async function environment(): Promise<{ ws: string; env: string }> {
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

const allow = (env: string, hosts: string[]) =>
	as(EVE).send("put", `/agent-secret-uses/environment/${env}/token`, {
		hosts,
	});

function send(
	ws: string,
	env: string,
	path = "/echo",
	extra: { name: string; value: string }[] = [],
) {
	if (!sendRequest) throw new Error("no send operation");
	return callAsAgent(sendRequest, EVE, {
		method: "GET",
		url: `{{base}}${path}`,
		headers: [{ name: "X-Api-Key", value: "{{token}}" }, ...extra],
		variables: { workspaceId: ws, environmentId: env },
	}) as Promise<{ status: number; body: string }>;
}

describe("where a secret filled for an agent may go", () => {
	it("needs the user to let agents use it, even a shared secret", async () => {
		const { ws, env } = await environment();
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 409,
			code: "AGENT_USE_REQUIRED",
			details: { keys: "token" },
		});
	});

	it("goes only to an allowed host", async () => {
		const { ws, env } = await environment();
		await allow(env, ["api.example.com", "*.example.org"]);
		await expect(send(ws, env)).rejects.toMatchObject({
			status: 409,
			code: "AGENT_HOST_NOT_ALLOWED",
		});
		await allow(env, ["127.0.0.1"]);
		expect((await send(ws, env)).status).toBe(200);
	});

	it("does not follow a redirect to another host", async () => {
		const { ws, env } = await environment();
		await allow(env, ["127.0.0.1"]);
		server.routes.set("/away", (_req, res) => {
			res.statusCode = 307;
			res.setHeader("location", `http://echo.test:${server.port}/echo`);
			res.end();
		});
		const res = await send(ws, env, "/away");
		expect(res.status).toBe(307);
	});

	it("refuses a Host header naming a host the secret may not reach", async () => {
		const { ws, env } = await environment();
		await allow(env, ["127.0.0.1"]);
		for (const value of [
			"evil-app.platform.example",
			"127.0.0.1/../evil.example",
			"abc123.localman.hoandat.com",
			"{{token}}.example",
		]) {
			await expect(
				send(ws, env, "/echo", [{ name: "host", value }]),
				value,
			).rejects.toMatchObject({
				status: 409,
				code: "AGENT_HOST_NOT_ALLOWED",
			});
		}
		await expect(
			send(ws, env, "/echo", [{ name: "Host", value: "{{token}}.example" }]),
		).rejects.toMatchObject({ details: { host: "[secret].example" } });
		const same = await send(ws, env, "/echo", [
			{ name: "Host", value: `127.0.0.1:${server.port}` },
		]);
		expect(same.status).toBe(200);
	});

	it("never lets a Localman host be allowed", async () => {
		const { env } = await environment();
		for (const host of [
			"abc123.localman.hoandat.com",
			"*.localman.example.com",
			"x.tunnel.example.com",
		]) {
			const res = await allow(env, ["api.example.com", host]);
			expect(res.status, host).toBe(400);
			expect(res.body).toMatchObject({
				error: { code: "AGENT_HOST_NOT_ALLOWED" },
			});
		}
	});

	it("is the user's own choice: listed, removed, never by an agent", async () => {
		const { ws, env } = await environment();
		await allow(env, ["127.0.0.1"]);
		const path = `/agent-secret-uses/environment/${env}`;
		expect((await as(EVE).get(path)).body).toEqual({
			uses: [{ key: "token", hosts: ["127.0.0.1"] }],
		});
		const removed = await as(EVE).send("delete", `${path}/token`);
		expect(removed.body).toEqual({ removed: true });
		await expect(send(ws, env)).rejects.toMatchObject({
			code: "AGENT_USE_REQUIRED",
		});
		await expect(
			callAsAgent(setAgentSecretUseOperation, EVE, {
				kind: "environment",
				id: env,
				key: "token",
				hosts: ["127.0.0.1"],
			}),
		).rejects.toMatchObject({ status: 401 });
		const plain = await as(EVE).send("put", `${path}/base`, {
			hosts: ["127.0.0.1"],
		});
		expect(plain.body).toMatchObject({
			error: { code: "AGENT_USE_NOT_SECRET" },
		});
	});
});
