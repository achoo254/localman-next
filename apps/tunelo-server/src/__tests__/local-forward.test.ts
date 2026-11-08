import http from "node:http";
import {
	type AuthResult,
	LOCAL_FORWARD,
	TUNNEL_SCOPES,
	type TunnelRequest,
} from "@tunelo/shared";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createIdpTokenVerifier } from "../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../auth/token-authenticator.js";
import { REFUSED_FORWARDS_PER_CALLER } from "../local-forward-relay.js";
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
const DEVICE = "chat-agent.0000-forward-test";
const OTHER_DEVICE = "chat-agent.0000-forward-other";
const DOMAIN = "tunnel.hoandat.com";
const SELF_SCOPES = [TUNNEL_SCOPES.READ, LOCAL_FORWARD.SCOPE];

const token = (c: string): string => `tunelo_${c.repeat(48)}`;
const OWN = token("a");
const OTHER_MACHINE = token("b");
const OTHER_ACCOUNT = token("c");
const PAIRING = token("d");
const READ_ONLY = token("e");
const NEVER_ONLINE = token("f");
const IDLE_DEVICE = "chat-agent.0000-forward-idle";

const keyStore = new FakeKeyStore();
const self = (owner: string, device: string, scopes = SELF_SCOPES) => ({
	kind: "link" as const,
	scopes,
	linkedOwnerSub: owner,
	linkedDeviceId: device,
});
keyStore.add(OWN, self(OWNER, DEVICE));
keyStore.add(OTHER_MACHINE, self(OWNER, OTHER_DEVICE));
keyStore.add(OTHER_ACCOUNT, self("acc_stranger", DEVICE));
keyStore.add(PAIRING, {
	kind: "link",
	scopes: [TUNNEL_SCOPES.READ],
	linkedDeviceId: DEVICE,
});
keyStore.add(READ_ONLY, self(OWNER, DEVICE, [TUNNEL_SCOPES.READ]));
keyStore.add(NEVER_ONLINE, self(OWNER, IDLE_DEVICE));

let idp: TestIdp;
let server: http.Server;
let port: number;
const open: WebSocket[] = [];
const host = `${machineSubdomain(OWNER, DEVICE)}.${DOMAIN}`;

beforeAll(async () => {
	idp = await createTestIdp();
	const authenticator = createTokenAuthenticator({
		config: {
			mode: "hybrid",
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			legacyCutoffMs: Date.parse("2099-01-01T00:00:00Z"),
		},
		keyStore,
		verifier: createIdpTokenVerifier({
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			keys: idp.keys,
		}),
	});
	server = http.createServer(createRelayHandler({ authenticator }));
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

interface Reply {
	status: number;
	code: string | undefined;
	body: string;
}

function send(
	path: string,
	headers: Record<string, string | string[]>,
	to = host,
): Promise<Reply> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, path, headers: { host: to, ...headers } },
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (c: Buffer) => chunks.push(c));
				res.on("end", () => {
					const code = res.headers["tunelo-forward-error"];
					resolve({
						status: res.statusCode ?? 0,
						code: typeof code === "string" ? code : undefined,
						body: Buffer.concat(chunks).toString(),
					});
				});
			},
		);
		req.on("error", reject);
		req.end();
	});
}

const FORWARD = "/.tunelo/forward/api/users?page=2";

describe("local forward gate", () => {
	test("anyone without the owner's link token gets 404, online or not", async () => {
		for (const online of [false, true]) {
			const machine = online ? await openMachine() : null;
			for (const access of [
				undefined,
				OTHER_MACHINE,
				OTHER_ACCOUNT,
				PAIRING,
				READ_ONLY,
				"tunelo_unknown",
				await idp.sign({ sub: OWNER }),
			]) {
				const reply = await send(FORWARD, {
					...(access ? { "tunelo-access": access } : {}),
					"tunelo-local-port": "5173",
				});
				expect(reply.status).toBe(404);
				expect(reply.code).toBe("TUNELO_FORWARD_001");
			}
			expect(machine?.seen ?? []).toEqual([]);
		}
	});

	test("the owner's token reaches the machine with the grant, never the token", async () => {
		const machine = await openMachine();
		const reply = await send(FORWARD, {
			"tunelo-access": OWN,
			"tunelo-local-port": "5173",
			"Tunelo-Forward-Granted": "forged",
			"tunelo-whatever": "x",
		});
		expect(reply).toMatchObject({ status: 200, body: "ok" });
		const [request] = machine.seen;
		expect(request?.path).toBe(FORWARD);
		expect(request?.headers["tunelo-forward-granted"]).toBe("1");
		expect(request?.headers["tunelo-local-port"]).toBe("5173");
		const names = Object.keys(request?.headers ?? {}).filter((name) =>
			name.startsWith("tunelo-"),
		);
		expect(names.sort()).toEqual([
			"tunelo-forward-granted",
			"tunelo-local-port",
		]);
	});

	test("without a port the request is for the machine itself (port list)", async () => {
		const machine = await openMachine();
		const reply = await send("/.tunelo/forward/ports", {
			"tunelo-access": OWN,
		});
		expect(reply.status).toBe(200);
		expect(machine.seen[0]?.headers["tunelo-local-port"]).toBeUndefined();
		expect(machine.seen[0]?.headers["tunelo-forward-granted"]).toBe("1");
	});

	test("blocked and malformed ports are refused before the machine", async () => {
		const machine = await openMachine();
		const blocked = await send(FORWARD, {
			"tunelo-access": OWN,
			"tunelo-local-port": "9222",
		});
		expect(blocked).toMatchObject({ status: 403, code: "TUNELO_FORWARD_002" });
		const bad = await send(FORWARD, {
			"tunelo-access": OWN,
			"tunelo-local-port": "80; 9222",
		});
		expect(bad).toMatchObject({ status: 400, code: "TUNELO_FORWARD_004" });
		// A repeated header arrives joined ("80, 9222"): not a port.
		const twice = await send(FORWARD, {
			"tunelo-access": OWN,
			"tunelo-local-port": ["80", "9222"],
		});
		expect(twice).toMatchObject({ status: 400, code: "TUNELO_FORWARD_004" });
		// Leading zeros name the same port.
		const padded = await send(FORWARD, {
			"tunelo-access": OWN,
			"tunelo-local-port": "09222",
		});
		expect(padded).toMatchObject({ status: 403, code: "TUNELO_FORWARD_002" });
		expect(machine.seen).toEqual([]);
	});

	test("the owner is told when the machine is offline", async () => {
		const idle = `${machineSubdomain(OWNER, IDLE_DEVICE)}.${DOMAIN}`;
		const reply = await send(
			FORWARD,
			{
				"tunelo-access": NEVER_ONLINE,
				"tunelo-local-port": "5173",
			},
			idle,
		);
		expect(reply).toMatchObject({ status: 502, code: "TUNELO_TUNNEL_002" });
	});

	test("a forged grant never reaches the machine on another path", async () => {
		const machine = await openMachine();
		await send("/e2e/channel", {
			"Tunelo-Forward-Granted": "1",
			"tunelo-local-port": "22",
			"tunelo-access": OWN,
		});
		const headers = machine.seen[0]?.headers ?? {};
		expect(Object.keys(headers).some((n) => n.startsWith("tunelo-"))).toBe(
			false,
		);
	});

	test("an ordinary tunnel loses the forward headers, keeps its own path", async () => {
		const key = await idp.sign({ sub: "acc_plain" });
		const plain = await openTunnel({ key, subdomain: "plain-forward-app" });
		expect(plain.result.features).toBeUndefined();
		const reply = await send(
			FORWARD,
			{ "tunelo-forward-granted": "1", "tunelo-access": OWN },
			`plain-forward-app.${DOMAIN}`,
		);
		expect(reply.status).toBe(200);
		const headers = plain.seen[0]?.headers ?? {};
		expect(headers["tunelo-forward-granted"]).toBeUndefined();
		expect(headers["tunelo-access"]).toBeUndefined();
	});

	test("machine tunnels learn that the server gates forwards", async () => {
		const machine = await openMachine();
		expect(machine.result.features).toEqual(["local-forward"]);
	});

	test("no WebSocket under the forward path", async () => {
		await openMachine();
		const ws = new WebSocket(`ws://127.0.0.1:${port}/.tunelo/forward/x`, {
			headers: { host, "tunelo-access": OWN },
		});
		const status = await new Promise<number>((resolve) => {
			ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
			ws.on("error", () => resolve(-1));
		});
		expect(status).toBe(404);
	});

	test("a WebSocket on another path reaches the machine without tunelo-* headers", async () => {
		const machine = await openMachine();
		const ws = new WebSocket(`ws://127.0.0.1:${port}/e2e`, {
			headers: {
				host,
				"tunelo-forward-granted": "1",
				"tunelo-access": OWN,
				"tunelo-local-port": "22",
			},
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
		const names = Object.keys(machine.wsOpens[0] ?? {});
		expect(names.some((name) => name.startsWith("tunelo-"))).toBe(false);
	});

	// Last: it uses up the refusal budget of this test's address.
	test("a caller sending refused forwards is slowed down", async () => {
		let last: Reply | null = null;
		for (let i = 0; i <= REFUSED_FORWARDS_PER_CALLER; i++) {
			last = await send(FORWARD, { "tunelo-access": OTHER_ACCOUNT });
		}
		expect(last).toMatchObject({ status: 429, code: "TUNELO_FORWARD_006" });
		const owner = await send(FORWARD, { "tunelo-access": OWN });
		expect(owner.status).toBe(429);
	});
});
