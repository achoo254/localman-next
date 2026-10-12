import { randomBytes } from "node:crypto";
import pino from "pino";
import { beforeEach, describe, expect, test } from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { TokenCipher } from "../token-cipher.js";
import { WebSessionModel } from "../web-session-model.js";
import {
	SESSION_MAX_MS,
	type SessionTokens,
	WebSessionStore,
	hashSessionToken,
	sessionExpiry,
} from "../web-session-store.js";

useTestDatabase("web-session-store");

const DAY_MS = 24 * 60 * 60 * 1000;
const store = new WebSessionStore(
	new TokenCipher(randomBytes(32)),
	pino({ level: "silent" }),
);

function tokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
	return {
		refreshToken: `rt-${randomBytes(8).toString("hex")}`,
		idToken: "header.payload.signature",
		accessExp: new Date(Date.now() + 15 * 60 * 1000),
		refreshExp: new Date(Date.now() + 30 * DAY_MS),
		...overrides,
	};
}

function create(sub: string, sid: string) {
	return store.create({
		sub,
		sid,
		profile: { username: null, name: null },
		tokens: tokens(),
	});
}

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
});

describe("WebSessionStore", () => {
	test("expiresAt carries a TTL index", async () => {
		await WebSessionModel.syncIndexes();
		const indexes = await WebSessionModel.collection.indexes();
		const ttl = indexes.find((index) => index.key.expiresAt === 1);
		expect(ttl?.expireAfterSeconds).toBe(0);
		expect(indexes.some((index) => index.key.sid === 1)).toBe(true);
		expect(indexes.some((index) => index.key.sub === 1)).toBe(true);
	});

	test("expiry is min(sign-in + 90 days, refresh expiry)", () => {
		const loginAt = new Date("2026-10-01T00:00:00Z");
		const soon = new Date("2026-10-31T00:00:00Z");
		expect(sessionExpiry(loginAt, soon)).toEqual(soon);
		const late = new Date(loginAt.getTime() + 120 * DAY_MS);
		expect(sessionExpiry(loginAt, late).getTime()).toBe(
			loginAt.getTime() + SESSION_MAX_MS,
		);
	});

	test("keys rows by the cookie hash and encrypts tokens at rest", async () => {
		const input = tokens();
		const { cookieValue } = await store.create({
			sub: "acc_alice",
			sid: "sid-1",
			profile: { username: "alice", name: null },
			tokens: input,
		});
		const raw = await WebSessionModel.findOne().lean();
		expect(raw?._id).toBe(hashSessionToken(cookieValue));
		const dump = JSON.stringify(raw);
		expect(dump).not.toContain(cookieValue);
		expect(dump).not.toContain(input.refreshToken);
		expect(dump).not.toContain(input.idToken);

		const found = await store.findByCookie(cookieValue);
		expect(found?.refreshToken).toBe(input.refreshToken);
		expect(found?.idToken).toBe(input.idToken);
		expect(found?.profile).toEqual({ username: "alice", name: null });
	});

	test("each cookie reads only its own account", async () => {
		const alice = await create("acc_alice", "sid-a");
		const bob = await create("acc_bob", "sid-b");
		expect((await store.findByCookie(alice.cookieValue))?.sub).toBe(
			"acc_alice",
		);
		expect((await store.findByCookie(bob.cookieValue))?.sub).toBe("acc_bob");
		expect(await store.findByCookie("x".repeat(43))).toBeNull();
	});

	test("deleteBySid ends only sessions of that sid (and sub, when given)", async () => {
		await create("acc_alice", "sid-a");
		await create("acc_alice", "sid-a");
		const bob = await create("acc_bob", "sid-b");
		expect(await store.deleteBySid("sid-b", "acc_alice")).toBe(0);
		expect(await store.deleteBySid("sid-a", null)).toBe(2);
		expect((await store.findByCookie(bob.cookieValue))?.sub).toBe("acc_bob");
	});

	test("a blob copied from another row does not open; the row is dropped", async () => {
		const alice = await create("acc_alice", "sid-a");
		const bob = await create("acc_bob", "sid-b");
		const bobRow = await WebSessionModel.findById(bob.session.id).lean();
		await WebSessionModel.updateOne(
			{ _id: alice.session.id },
			{ $set: { refreshEnc: bobRow?.refreshEnc } },
		);
		expect(await store.findByCookie(alice.cookieValue)).toBeNull();
		expect(await WebSessionModel.countDocuments({ sub: "acc_alice" })).toBe(0);
	});

	test("saveRefreshed rotates the token and slides the expiry under the cap", async () => {
		const { session } = await create("acc_alice", "sid-a");
		const next = tokens({ refreshExp: new Date(Date.now() + 200 * DAY_MS) });
		const saved = await store.saveRefreshed(session, next);
		expect(saved?.refreshToken).toBe(next.refreshToken);
		expect(saved?.expiresAt.getTime()).toBe(
			session.loginAt.getTime() + SESSION_MAX_MS,
		);
	});
});
