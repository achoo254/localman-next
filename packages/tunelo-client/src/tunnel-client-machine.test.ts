import { afterEach, describe, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { TUNNEL_REFUSAL_CODES } from "./shared/constants.js";
import {
	TunnelAuthError,
	isFatal,
	stopsReconnecting,
} from "./tunnel-auth-error.js";
import { TunnelClient } from "./tunnel-client.js";

let wss: WebSocketServer | undefined;
let client: TunnelClient | undefined;

afterEach(async () => {
	client?.disconnect();
	client = undefined;
	await new Promise<void>((resolve) => {
		if (!wss) return resolve();
		wss.close(() => resolve());
	});
	wss = undefined;
});

/** A server that records each auth frame and answers with `reply`. */
async function serverAnswering(
	reply: Record<string, unknown>,
): Promise<{ url: string; auths: Record<string, unknown>[] }> {
	const auths: Record<string, unknown>[] = [];
	const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
	wss = server;
	server.on("connection", (socket) => {
		socket.on("message", (data) => {
			auths.push(JSON.parse(data.toString()) as Record<string, unknown>);
			socket.send(JSON.stringify({ type: "auth-result", ...reply }));
		});
	});
	await new Promise<void>((resolve) => server.once("listening", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	return { url: `http://127.0.0.1:${port}`, auths };
}

describe("machine tunnels", () => {
	test("the auth frame names the kind, machine and held subdomain", async () => {
		const server = await serverAnswering({
			success: true,
			subdomain: "m-0123",
			url: "https://m-0123.tunnel.example",
		});
		client = new TunnelClient({
			serverUrl: server.url,
			getApiKey: async () => "token",
			kind: "machine",
			deviceId: "machine-1",
			subdomain: "m-0123",
			localPort: 4000,
		});
		const result = await client.connect();
		expect(result.url).toBe("https://m-0123.tunnel.example");
		expect(server.auths[0]).toMatchObject({
			type: "auth",
			key: "token",
			kind: "machine",
			deviceId: "machine-1",
			subdomain: "m-0123",
		});
	});

	test("a refusal carries its code to the caller", async () => {
		const server = await serverAnswering({
			success: false,
			subdomain: "",
			url: "",
			error: "Subdomain is held for another machine",
			code: TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD,
		});
		client = new TunnelClient({
			serverUrl: server.url,
			getApiKey: async () => "token",
			kind: "machine",
			deviceId: "machine-1",
			localPort: 4000,
		});
		const err: unknown = await client.connect().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(TunnelAuthError);
		expect(err).toMatchObject({ code: "TUNELO_TUNNEL_004", fatal: true });
	});
});

describe("when reconnecting stops", () => {
	const quota = new TunnelAuthError("full", "TUNELO_TUNNEL_005");

	test("held subdomains and refused tokens stop every client", () => {
		expect(isFatal(new TunnelAuthError("held", "TUNELO_TUNNEL_004"))).toBe(
			true,
		);
		expect(isFatal(new TunnelAuthError("scope", "TUNELO_AUTH_003"))).toBe(true);
		expect(isFatal(new TunnelAuthError("in use", "TUNELO_TUNNEL_001"))).toBe(
			false,
		);
	});

	test("a full quota stops a machine tunnel but not `tunelo http`", () => {
		expect(stopsReconnecting(quota, "machine")).toBe(true);
		expect(stopsReconnecting(quota, undefined)).toBe(false);
		expect(stopsReconnecting(new Error("network"), "machine")).toBe(false);
	});
});
