import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVault, openValue, valueAad } from "./vault-crypto";
import { migrateLegacyValues } from "./vault-migration";

interface Item {
	scope: string;
	key: string;
	expected: string;
	value: string;
}

const server = vi.hoisted(() => ({
	pages: [] as {
		values: { scope: string; key: string; value: string }[];
		more: boolean;
	}[],
	posted: [] as Item[][],
	key: null as CryptoKey | null,
	lockAfterPost: false,
}));

vi.mock("../../lib/api-client", () => ({
	apiRequest: async (
		_path: string,
		init?: { method?: string; body?: { items: Item[] } },
	) => {
		if (init?.method === "POST") {
			const items = init.body?.items ?? [];
			server.posted.push(items);
			if (server.lockAfterPost) server.key = null;
			return { sealed: items.length, skipped: 0 };
		}
		return server.pages.shift() ?? { values: [], more: false };
	},
}));

vi.mock("./vault-session", () => ({
	vaultKey: () => server.key,
}));

const ENV = "environment:65f0a1b2c3d4e5f60718293a";
const COL = "collection:65f0a1b2c3d4e5f60718293b";

beforeEach(async () => {
	server.key = (await createVault("correct horse battery")).key;
	server.posted = [];
	server.lockAfterPost = false;
});
afterEach(() => {
	server.pages = [];
});

describe("moving pre-vault secret values into the vault", () => {
	it("seals each value for its scope and name, page after page", async () => {
		server.pages = [
			{
				values: [{ scope: ENV, key: "token", value: "old-token" }],
				more: true,
			},
			{ values: [{ scope: COL, key: "key", value: "old-key" }], more: false },
		];
		expect(await migrateLegacyValues()).toBe(2);
		const [first, second] = server.posted;
		expect(first?.[0]).toMatchObject({
			scope: ENV,
			key: "token",
			expected: "old-token",
		});
		const key = server.key;
		if (!key || !first?.[0] || !second?.[0]) throw new Error("not sent");
		expect(await openValue(key, first[0].value, valueAad(ENV, "token"))).toBe(
			"old-token",
		);
		expect(await openValue(key, second[0].value, valueAad(COL, "key"))).toBe(
			"old-key",
		);
	});

	it("does nothing while the vault is locked, and stops when it locks", async () => {
		server.key = null;
		server.pages = [
			{ values: [{ scope: ENV, key: "token", value: "x-token" }], more: false },
		];
		expect(await migrateLegacyValues()).toBe(0);
		expect(server.posted).toEqual([]);

		server.key = (await createVault("another passphrase")).key;
		server.lockAfterPost = true;
		server.pages = [
			{ values: [{ scope: ENV, key: "a", value: "one-value" }], more: true },
			{ values: [{ scope: ENV, key: "b", value: "two-value" }], more: false },
		];
		expect(await migrateLegacyValues()).toBe(1);
		expect(server.posted).toHaveLength(1);
	});
});
