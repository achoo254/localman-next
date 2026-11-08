import http from "node:http";
import type { AuthResult, RegisterTunnelResult } from "@tunelo/shared";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createIdpTokenVerifier } from "../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../auth/token-authenticator.js";
import { machineSubdomain } from "../machine-subdomain.js";
import { FakeKeyStore } from "../test-support/fake-key-store.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../test-support/idp-test-keys.js";
import { listByOwner } from "../tunnel-directory.js";
import { attachWsHandler } from "../ws-handler.js";

const LEGACY = `tunelo_${"c".repeat(48)}`;
const MACHINE_ID = "6f1c2d3e-0000-4000-8000-000000000001";

let idp: TestIdp;
let server: http.Server;
let port: number;
const open: WebSocket[] = [];

const keyStore = new FakeKeyStore();
keyStore.add(LEGACY, { kind: "legacy", deviceId: "dev-anon" });

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
	server = http.createServer();
	attachWsHandler(server, authenticator);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	port = typeof address === "object" && address ? address.port : 0;
});

afterEach(async () => {
	await Promise.all(
		open.splice(0).map(
			(ws) =>
				new Promise<void>((resolve) => {
					if (ws.readyState === WebSocket.CLOSED) return resolve();
					ws.once("close", () => resolve());
					ws.close();
				}),
		),
	);
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

interface Channel {
	ws: WebSocket;
	result: AuthResult;
	closeCode: Promise<number>;
}

/** Opens a control channel and sends `auth`; resolves with the reply. */
function authenticate(message: Record<string, unknown>): Promise<Channel> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${port}/tunnel`);
		open.push(ws);
		const closeCode = new Promise<number>((r) => ws.once("close", r));
		ws.on("open", () => ws.send(JSON.stringify({ type: "auth", ...message })));
		ws.once("message", (data) => {
			const result = JSON.parse(data.toString()) as AuthResult;
			resolve({ ws, result, closeCode });
		});
		ws.on("error", reject);
	});
}

function machine(token: string, extra: Record<string, unknown> = {}) {
	return authenticate({
		key: token,
		kind: "machine",
		deviceId: MACHINE_ID,
		localPort: 4000,
		subdomain: "",
		...extra,
	});
}

describe("machine tunnels", () => {
	test("a machine gets the subdomain held for its account and id, every time", async () => {
		const token = await idp.sign({ sub: "acc_m1" });
		const first = await machine(token);
		const held = machineSubdomain("acc_m1", MACHINE_ID);
		expect(first.result).toMatchObject({ success: true, subdomain: held });
		first.ws.close();
		await first.closeCode;

		const again = await machine(token, { subdomain: held });
		expect(again.result).toMatchObject({ success: true, subdomain: held });
	});

	test("the same machine replaces its stale connection", async () => {
		const token = await idp.sign({ sub: "acc_m2" });
		const stale = await machine(token);
		const fresh = await machine(token, { subdomain: stale.result.subdomain });
		expect(fresh.result.success).toBe(true);
		await stale.closeCode;
		expect(listByOwner("acc_m2")).toHaveLength(1);
	});

	test("no one else can take a machine's subdomain", async () => {
		const held = (await machine(await idp.sign({ sub: "acc_m3" }))).result
			.subdomain;
		const other = await idp.sign({ sub: "acc_intruder" });

		const asMachine = await machine(other, { subdomain: held });
		expect(asMachine.result).toMatchObject({
			success: false,
			code: "TUNELO_TUNNEL_004",
		});
		const asHttp = await authenticate({ key: other, subdomain: held });
		expect(asHttp.result).toMatchObject({
			success: false,
			code: "TUNELO_TUNNEL_004",
		});
		const anonymous = await authenticate({ key: LEGACY, subdomain: held });
		expect(anonymous.result.code).toBe("TUNELO_TUNNEL_004");
	});

	test("machine tunnels need an account token and a device id", async () => {
		const legacy = await machine(LEGACY);
		expect(legacy.result).toMatchObject({
			success: false,
			code: "TUNELO_AUTH_003",
		});
		const noId = await machine(await idp.sign({ sub: "acc_m4" }), {
			deviceId: undefined,
		});
		expect(noId.result.success).toBe(false);
	});

	test("machines have a quota of their own, apart from `tunelo http`", async () => {
		const token = await idp.sign({ sub: "acc_m5" });
		for (const name of ["m5-a", "m5-b", "m5-c"]) {
			expect(
				(await authenticate({ key: token, subdomain: name })).result,
			).toMatchObject({ success: true });
		}
		const http4 = await authenticate({ key: token, subdomain: "m5-d" });
		expect(http4.result).toMatchObject({
			success: false,
			code: "TUNELO_TUNNEL_005",
			error: "Max tunnels per key exceeded",
		});

		const ids = [1, 2, 3, 4, 5].map((n) => `machine-id-${n}-of-acc-m5`);
		for (const deviceId of ids) {
			expect((await machine(token, { deviceId })).result.success).toBe(true);
		}
		const sixth = await machine(token, { deviceId: "machine-id-6-of-acc-m5" });
		expect(sixth.result).toMatchObject({
			success: false,
			code: "TUNELO_TUNNEL_005",
		});
		// A machine already counted comes back fine at the limit.
		const back = await machine(token, { deviceId: ids[0] });
		expect(back.result.success).toBe(true);
	});

	test("a machine channel opens no second tunnel", async () => {
		const { ws } = await machine(await idp.sign({ sub: "acc_m6" }));
		const reply = new Promise<RegisterTunnelResult>((resolve) =>
			ws.once("message", (data) =>
				resolve(JSON.parse(data.toString()) as RegisterTunnelResult),
			),
		);
		ws.send(
			JSON.stringify({
				type: "register-tunnel",
				subdomain: "m6-extra",
				localPort: 5000,
			}),
		);
		expect(await reply).toMatchObject({ success: false });
		expect(listByOwner("acc_m6")).toHaveLength(1);
	});
});
