import http from "node:http";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { pollForTokens, startDeviceAuthorization } from "./device-login.js";
import {
	IDP_DEFAULTS,
	type IdpEndpoints,
	refreshTokens,
	revokeToken,
} from "./idp-client.js";

let server: http.Server;
let forms: { path: string; form: URLSearchParams }[] = [];
let endpoints: IdpEndpoints;

beforeEach(async () => {
	forms = [];
	server = http.createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const path = req.url ?? "";
			forms.push({
				path,
				form: new URLSearchParams(Buffer.concat(chunks).toString()),
			});
			res.writeHead(200, { "content-type": "application/json" });
			if (path === "/device") {
				res.end(
					JSON.stringify({
						device_code: "dc",
						user_code: "ABCD-EFGH",
						verification_uri: "http://127.0.0.1/device",
						expires_in: 600,
						interval: 1,
					}),
				);
			} else if (path === "/token") {
				res.end(
					JSON.stringify({
						access_token: "at",
						refresh_token: "rt-2",
						expires_in: 300,
					}),
				);
			} else {
				res.end("");
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
	endpoints = {
		deviceAuthorization: `${base}/device`,
		token: `${base}/token`,
		revocation: `${base}/revoke`,
	};
});

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("OAuth client of each call", () => {
	test("defaults to the CLI's client", async () => {
		await refreshTokens(endpoints, "rt-1", "https://tunnel.example");
		await revokeToken(endpoints, "rt-2");
		expect(forms.map((f) => f.form.get("client_id"))).toEqual([
			IDP_DEFAULTS.clientId,
			IDP_DEFAULTS.clientId,
		]);
	});

	test("refresh, revoke and device sign-in use the client they are given", async () => {
		await refreshTokens(endpoints, "rt-1", "https://chat.example/mcp", "agent");
		await revokeToken(endpoints, "rt-2", "agent");
		const authorization = await startDeviceAuthorization(
			endpoints,
			"host",
			["https://tunnel.example", "https://chat.example/mcp"],
			{ clientId: "agent", scope: "openid chat:read" },
		);
		await pollForTokens(endpoints, authorization, {
			clientId: "agent",
			sleep: async () => {},
		});
		expect(forms.map((f) => f.form.get("client_id"))).toEqual([
			"agent",
			"agent",
			"agent",
			"agent",
		]);
		const device = forms.find((f) => f.path === "/device")?.form;
		expect(device?.getAll("resource")).toEqual([
			"https://tunnel.example",
			"https://chat.example/mcp",
		]);
		expect(device?.get("scope")).toBe("openid chat:read");
		expect(forms[0]?.form.get("resource")).toBe("https://chat.example/mcp");
	});

	test("polling a sign-in of several resources names the one to redeem", async () => {
		const authorization = await startDeviceAuthorization(
			endpoints,
			"host",
			["https://tunnel.example", "https://chat.example/mcp"],
			{ clientId: "agent" },
		);
		await pollForTokens(endpoints, authorization, {
			clientId: "agent",
			resource: "https://tunnel.example",
			sleep: async () => {},
		});
		const poll = forms.find((f) => f.path === "/token")?.form;
		expect(poll?.get("grant_type")).toBe(
			"urn:ietf:params:oauth:grant-type:device_code",
		);
		expect(poll?.getAll("resource")).toEqual(["https://tunnel.example"]);
	});

	test("polling without a resource sends none, as before", async () => {
		const authorization = await startDeviceAuthorization(
			endpoints,
			"host",
			"https://tunnel.example",
		);
		await pollForTokens(endpoints, authorization, { sleep: async () => {} });
		const poll = forms.find((f) => f.path === "/token")?.form;
		expect(poll?.has("resource")).toBe(false);
	});
});
