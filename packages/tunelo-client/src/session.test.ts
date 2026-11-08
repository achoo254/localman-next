import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	type IdpEndpoints,
	OAuthResponseError,
	type TokenSet,
} from "./idp-client.js";
import { type StoredSession, fileSessionStore } from "./session-store.js";
import {
	SessionExpiredError,
	UntrustedServerError,
	accountTokenFor,
	getAccessToken,
} from "./session.js";

const NOW = 1_800_000_000_000;
const endpoints: IdpEndpoints = {
	deviceAuthorization: "https://idp/device/auth",
	token: "https://idp/token",
	revocation: null,
};
const SESSION: StoredSession = {
	issuer: "https://auth.acme.example",
	sub: "acc_alice",
	refreshToken: "rt-1",
	accessToken: "at-old",
	accessTokenExpiresAt: NOW - 1,
};

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tunelo-session-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function storeAt(name = "agent/session.json") {
	return fileSessionStore(join(dir, name));
}

function rotating(): {
	used: string[];
	refresh: (e: IdpEndpoints, rt: string) => Promise<TokenSet>;
} {
	const used: string[] = [];
	let n = 1;
	return {
		used,
		refresh: async (_e, rt) => {
			used.push(rt);
			n++;
			return {
				accessToken: `at-${n}`,
				refreshToken: `rt-${n}`,
				idToken: null,
				expiresIn: 300,
			};
		},
	};
}

const deps = (refresh: (e: IdpEndpoints, rt: string) => Promise<TokenSet>) => ({
	discover: async () => endpoints,
	refresh,
	sleep: async () => undefined,
	now: () => NOW,
});

describe("file session store", () => {
	test("keeps the session in the caller's file, owner-only", () => {
		const store = storeAt();
		expect(store.load()).toBeUndefined();
		store.save(SESSION);
		expect(store.load()).toEqual(SESSION);
		expect(store.lockPath).toBe(join(dir, "agent/session.json.lock"));
		if (process.platform !== "win32") {
			expect(statSync(join(dir, "agent/session.json")).mode & 0o777).toBe(
				0o600,
			);
		}
		store.clear();
		expect(store.load()).toBeUndefined();
	});
});

describe("getAccessToken", () => {
	test("refreshes an expiring token and saves the rotated session first", async () => {
		const store = storeAt();
		store.save(SESSION);
		const idp = rotating();
		expect(await getAccessToken(store, deps(idp.refresh))).toBe("at-2");
		expect(idp.used).toEqual(["rt-1"]);
		expect(store.load()).toMatchObject({
			refreshToken: "rt-2",
			accessToken: "at-2",
		});
		// Still fresh: no second refresh.
		expect(await getAccessToken(store, deps(idp.refresh))).toBe("at-2");
		expect(idp.used).toEqual(["rt-1"]);
	});

	test("a dead grant clears the session and says so", async () => {
		const store = storeAt();
		store.save(SESSION);
		const refresh = async (): Promise<TokenSet> => {
			throw new OAuthResponseError("invalid_grant", 400);
		};
		await expect(getAccessToken(store, deps(refresh))).rejects.toBeInstanceOf(
			SessionExpiredError,
		);
		expect(store.load()).toBeUndefined();
	});

	test("no session is an expired session", async () => {
		await expect(
			getAccessToken(storeAt(), deps(rotating().refresh)),
		).rejects.toMatchObject({ fatal: true, name: "SessionExpiredError" });
	});
});

describe("accountTokenFor", () => {
	test("hands the token only to the Tunelo of the session's domain", async () => {
		const store = storeAt();
		store.save({ ...SESSION, accessTokenExpiresAt: NOW + 600_000 });
		const own = accountTokenFor(store, "https://tunnel.acme.example", {
			now: () => NOW,
		});
		expect(await own()).toBe("at-old");
		const other = accountTokenFor(store, "https://tunnel.evil.example");
		await expect(other()).rejects.toBeInstanceOf(UntrustedServerError);
	});
});
