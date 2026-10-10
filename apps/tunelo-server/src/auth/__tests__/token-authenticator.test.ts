import { beforeAll, describe, expect, test } from "vitest";
import type { AuthConfig } from "../../config/auth-config.js";
import { FakeKeyStore } from "../../test-support/fake-key-store.js";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../../test-support/idp-test-keys.js";
import { createIdpTokenVerifier } from "../idp-token-verifier.js";
import { createTokenAuthenticator } from "../token-authenticator.js";

const CUTOFF = Date.parse("2026-12-08T00:00:00Z");
const LEGACY = `tunelo_${"1".repeat(48)}`;
const LINK = `tunelo_${"2".repeat(48)}`;

let idp: TestIdp;
const keyStore = new FakeKeyStore();
keyStore.add(LEGACY, { kind: "legacy", deviceId: "dev-1" });
keyStore.add(LINK, {
	kind: "link",
	scopes: ["tunnels:read"],
	linkedDeviceId: "dev-1",
});

function authenticatorAt(nowMs: number, mode: AuthConfig["mode"] = "hybrid") {
	return createTokenAuthenticator({
		config: {
			mode,
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
}

beforeAll(async () => {
	idp = await createTestIdp();
});

describe("token authenticator", () => {
	test("an account JWT becomes an account-bound key", async () => {
		const outcome = await authenticatorAt(CUTOFF + 1).authenticate(
			await idp.sign({ sub: "acc_bob" }),
			"tunnels:open",
		);
		expect(outcome.ok && outcome.keyInfo).toMatchObject({
			kind: "idp",
			ownerSub: "acc_bob",
			maxTunnels: 3,
		});
	});

	test("an anonymous token opens tunnels before the cutoff", async () => {
		const outcome = await authenticatorAt(CUTOFF - 1).authenticate(
			LEGACY,
			"tunnels:open",
		);
		expect(outcome.ok).toBe(true);
	});

	test("an anonymous token is refused from the cutoff on", async () => {
		const outcome = await authenticatorAt(CUTOFF).authenticate(
			LEGACY,
			"tunnels:open",
		);
		expect(outcome).toMatchObject({ ok: false, code: "TUNELO_AUTH_004" });
		expect(!outcome.ok && outcome.message).toContain("tunelo login");
	});

	test("rollback mode ignores the cutoff and turns the JWT branch off", async () => {
		const legacy = authenticatorAt(CUTOFF + 1, "legacy");
		expect((await legacy.authenticate(LEGACY, "tunnels:open")).ok).toBe(true);
		expect(legacy.legacyCutoffIso()).toBeUndefined();
		const jwt = await legacy.authenticate(await idp.sign(), "tunnels:open");
		expect(jwt).toMatchObject({ ok: false, code: "TUNELO_AUTH_001" });
	});

	test("a link token may list but never open", async () => {
		const auth = authenticatorAt(CUTOFF - 1);
		expect(await auth.authenticate(LINK, "tunnels:open")).toMatchObject({
			ok: false,
			code: "TUNELO_AUTH_003",
		});
		expect((await auth.authenticate(LINK, "tunnels:read")).ok).toBe(true);
	});

	test("an anonymous token cannot list tunnels", async () => {
		const outcome = await authenticatorAt(CUTOFF - 1).authenticate(
			LEGACY,
			"tunnels:read",
		);
		expect(outcome).toMatchObject({ ok: false, code: "TUNELO_AUTH_003" });
	});

	test("unknown tokens are invalid", async () => {
		const outcome = await authenticatorAt(0).authenticate(
			`tunelo_${"9".repeat(48)}`,
			null,
		);
		expect(outcome).toMatchObject({ ok: false, code: "TUNELO_AUTH_001" });
	});
});
