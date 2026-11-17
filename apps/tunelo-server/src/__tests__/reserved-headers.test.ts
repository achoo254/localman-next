import http from "node:http";
import type { AuthResult, TunnelRequest } from "@tunelo/shared";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createIdpTokenVerifier } from "../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../auth/token-authenticator.js";
import { machineSubdomain } from "../machine-subdomain.js";
import { createRelayHandler } from "../request-relay.js";
import { FakeKeyStore } from "../test-support/fake-key-store.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../test-support/idp-test-keys.js";
import { attachWsHandler } from "../ws-handler.js";

const OWNER = "acc_owner";
const DEVICE = "tunelo.0000-header-test";
const DOMAIN = "tunnel.hoandat.com";
const machineHost = `${machineSubdomain(OWNER, DEVICE)}.${DOMAIN}`;

/** Headers a client may forge; only Tunelo may name a `tunelo-*` header. */
const FORGED = {
	"Tunelo-Access": "tunelo_forged",
	"tunelo-port": "22",
	"tunelo-anything": "x",
};

let idp: TestIdp;
let server: http.Server;
let port: number;
const open: WebSocket[] = [];

beforeAll(async () => {
	idp = await createTestIdp();
	const authenticator = createTokenAuthenticator({
		config: {
			mode: "hybrid",
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			legacyCutoffMs: Date.parse("2099-01-01T00:00:00Z"),
		},
		keyStore: new FakeKeyStore(),
		verifier: createIdpTokenVerifier({
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			keys: idp.keys,
		}),
	});
	server = http.createServer(createRelayHandler());
	attachWsHandler(server, authenticator);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	port = typeof address === "object" && address ? address.port : 0;
});

afterEach(() => {
	for (const ws of open.splice(0)) ws.terminate();
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

interface Tunnel {
	result: AuthResult;
	/** Requests the relay sent to this client. */
	seen: TunnelRequest[];
	/** Headers of browser WebSockets the relay asked this client to open. */
	wsOpens: Record<string, string | string[]>[];
}

/** A client that answers every relayed request with 200 "ok". */
async function openTunnel(auth: Record<string, unknown>): Promise<Tunnel> {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/tunnel`, {
		headers: { host: DOMAIN },
	});
	open.push(ws);
	const seen: TunnelRequest[] = [];
	const wsOpens: Record<string, string | string[]>[] = [];
	const result = await new Promise<AuthResult>((resolve, reject) => {
		ws.on("open", () => ws.send(JSON.stringify({ type: "auth", ...auth })));
		ws.once("message", (data) => resolve(JSON.parse(String(data))));
		ws.on("error", reject);
	});
	ws.on("message", (data) => {
		const msg = JSON.parse(String(data)) as {
			type: string;
			headers?: Record<string, string | string[]>;
		};
		if (msg.type === "ws-open") wsOpens.push(msg.headers ?? {});
		if (msg.type !== "request") return;
		const request = msg as TunnelRequest;
		seen.push(request);
		ws.send(
			JSON.stringify({
				type: "response",
				id: request.id,
				status: 200,
				headers: { "content-type": "text/plain", "content-length": "2" },
				body: Buffer.from("ok").toString("base64"),
			}),
		);
	});
	return { result, seen, wsOpens };
}

async function openMachine(): Promise<Tunnel> {
	const key = await idp.sign({ sub: OWNER });
	return openTunnel({ key, kind: "machine", deviceId: DEVICE, subdomain: "" });
}

function send(
	path: string,
	headers: Record<string, string>,
	to: string,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, path, headers: { host: to, ...headers } },
			(res) => {
				res.resume();
				res.on("end", () => resolve(res.statusCode ?? 0));
			},
		);
		req.on("error", reject);
		req.end();
	});
}

function tuneloNames(headers: Record<string, string | string[]>): string[] {
	return Object.keys(headers).filter((name) => name.startsWith("tunelo-"));
}

describe("client-sent tunelo-* headers", () => {
	test("never reach a machine tunnel", async () => {
		const machine = await openMachine();
		expect(await send("/e2e/channel", FORGED, machineHost)).toBe(200);
		expect(tuneloNames(machine.seen[0]?.headers ?? {})).toEqual([]);
	});

	test("never reach an ordinary tunnel, which keeps its other headers", async () => {
		const key = await idp.sign({ sub: "acc_plain" });
		const plain = await openTunnel({ key, subdomain: "plain-header-app" });
		const status = await send(
			"/api/users",
			{ ...FORGED, "x-app": "kept" },
			`plain-header-app.${DOMAIN}`,
		);
		expect(status).toBe(200);
		const headers = plain.seen[0]?.headers ?? {};
		expect(tuneloNames(headers)).toEqual([]);
		expect(headers["x-app"]).toBe("kept");
	});

	test("never reach a machine through a WebSocket", async () => {
		const machine = await openMachine();
		const ws = new WebSocket(`ws://127.0.0.1:${port}/e2e`, {
			headers: { host: machineHost, ...FORGED },
		});
		ws.on("error", () => undefined);
		open.push(ws);
		await new Promise<void>((resolve) => {
			const check = setInterval(() => {
				if (machine.wsOpens.length > 0) {
					clearInterval(check);
					resolve();
				}
			}, 5);
		});
		expect(tuneloNames(machine.wsOpens[0] ?? {})).toEqual([]);
	});

	test("a machine tunnel is granted no optional server feature", async () => {
		const machine = await openMachine();
		expect(machine.result.success).toBe(true);
		expect(Object.keys(machine.result)).not.toContain("features");
	});
});
