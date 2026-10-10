import http from "node:http";
import type { AuthResult } from "@tunelo/shared";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createIdpTokenVerifier } from "../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../auth/token-authenticator.js";
import { FakeKeyStore } from "../test-support/fake-key-store.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../test-support/idp-test-keys.js";
import { listByDeviceId, listByOwner } from "../tunnel-directory.js";
import { attachWsHandler } from "../ws-handler.js";

const CUTOFF = Date.parse("2026-12-08T00:00:00Z");
const LEGACY = `tunelo_${"a".repeat(48)}`;
const LINK = `tunelo_${"b".repeat(48)}`;

let idp: TestIdp;
let server: http.Server;
let port: number;
/** Fake clock the authenticator reads; tests move it across the cutoff. */
let nowMs = CUTOFF - 1;
const open: WebSocket[] = [];

const keyStore = new FakeKeyStore();
keyStore.add(LEGACY, { kind: "legacy", deviceId: "dev-anon" });
keyStore.add(LINK, {
	kind: "link",
	scopes: ["tunnels:read"],
	linkedDeviceId: "dev-anon",
});

beforeAll(async () => {
	idp = await createTestIdp();
	const authenticator = createTokenAuthenticator({
		config: {
			mode: "hybrid",
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			legacyCutoffMs: CUTOFF,
		},
		keyStore,
		verifier: createIdpTokenVerifier({
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			keys: idp.keys,
		}),
		now: () => nowMs,
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
	nowMs = CUTOFF - 1;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Opens a control channel, sends `auth`, resolves with the server's reply. */
function authenticate(
	message: Record<string, unknown>,
): Promise<{ result: AuthResult; closeCode: number | null }> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${port}/tunnel`);
		open.push(ws);
		let result: AuthResult | null = null;
		ws.on("open", () => ws.send(JSON.stringify({ type: "auth", ...message })));
		ws.on("message", (data) => {
			result = JSON.parse(data.toString()) as AuthResult;
			if (result.success) resolve({ result, closeCode: null });
		});
		ws.on("close", (code) => {
			if (result && !result.success) resolve({ result, closeCode: code });
			else if (!result) reject(new Error(`closed (${code}) without a reply`));
		});
		ws.on("error", reject);
	});
}

describe("tunnel auth over WebSocket", () => {
	test("an account JWT with tunnels:open opens a tunnel on the primary domain", async () => {
		const { result } = await authenticate({
			key: await idp.sign(),
			subdomain: "alice-app",
			localPort: 3000,
			deviceId: "mac-1",
			deviceName: "alice-mac",
		});
		expect(result.success).toBe(true);
		expect(result.url).toBe("https://alice-app.tunnel.hoandat.com");
		expect(result.legacyTokenCutoff).toBeUndefined();
	});

	test("a JWT without tunnels:open is refused with TUNELO_AUTH_003", async () => {
		const { result, closeCode } = await authenticate({
			key: await idp.sign({ scope: "tunnels:read" }),
			subdomain: "",
		});
		expect(result.code).toBe("TUNELO_AUTH_003");
		expect(closeCode).toBe(4001);
	});

	test("a link token is refused with TUNELO_AUTH_003", async () => {
		const { result } = await authenticate({ key: LINK, subdomain: "" });
		expect(result).toMatchObject({ success: false, code: "TUNELO_AUTH_003" });
	});

	test("an anonymous token works before the cutoff and is told the date", async () => {
		const { result } = await authenticate({ key: LEGACY, subdomain: "anon-1" });
		expect(result.success).toBe(true);
		expect(result.legacyTokenCutoff).toBe("2026-12-08T00:00:00.000Z");
	});

	test("an anonymous token is refused after the cutoff with TUNELO_AUTH_004", async () => {
		nowMs = CUTOFF + 1;
		const { result } = await authenticate({ key: LEGACY, subdomain: "anon-2" });
		expect(result).toMatchObject({ success: false, code: "TUNELO_AUTH_004" });
		expect(result.error).toContain("tunelo login");
	});

	test("a malformed auth message closes the channel", async () => {
		await expect(authenticate({ key: 42 })).rejects.toThrow(/closed \(4001\)/);
	});

	test("one account's tunnels on two machines are listed together", async () => {
		const token = await idp.sign({ sub: "acc_carol" });
		await authenticate({
			key: token,
			subdomain: "carol-web",
			localPort: 5173,
			deviceName: "laptop",
		});
		await authenticate({
			key: token,
			subdomain: "carol-api",
			localPort: 4000,
			deviceName: "desktop",
		});
		await authenticate({ key: LEGACY, subdomain: "anon-3", localPort: 8080 });

		const carol = listByOwner("acc_carol");
		expect(carol.map((t) => [t.subdomain, t.deviceName, t.localPort])).toEqual([
			["carol-web", "laptop", 5173],
			["carol-api", "desktop", 4000],
		]);
		expect(listByOwner("acc_other")).toEqual([]);
		expect(listByDeviceId("dev-anon").map((t) => t.subdomain)).toEqual([
			"anon-3",
		]);
	});

	test("a tcpOnly channel opens no HTTP tunnel", async () => {
		const { result } = await authenticate({
			key: await idp.sign({ sub: "acc_erin" }),
			subdomain: "",
			tcpOnly: true,
		});
		expect(result).toMatchObject({ success: true, subdomain: "", url: "" });
		expect(listByOwner("acc_erin")).toEqual([]);
	});

	test("an account may hold at most three tunnels across machines", async () => {
		const token = await idp.sign({ sub: "acc_dave" });
		for (const name of ["dave-1", "dave-2", "dave-3"]) {
			expect(
				(await authenticate({ key: token, subdomain: name })).result.success,
			).toBe(true);
		}
		const { result } = await authenticate({ key: token, subdomain: "dave-4" });
		expect(result).toMatchObject({
			success: false,
			error: "Max tunnels per key exceeded",
		});
	});
});
