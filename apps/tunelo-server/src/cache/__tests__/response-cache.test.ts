import { beforeEach, describe, expect, test, vi } from "vitest";

const { store, fake } = vi.hoisted(() => {
	const store = new Map<string, string>();
	const fake = {
		get: vi.fn(async (k: string) => store.get(k) ?? null),
		set: vi.fn(async (k: string, v: string) => {
			store.set(k, v);
			return "OK";
		}),
		scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
			const prefix = pattern.replace(/\*$/, "");
			const keys = [...store.keys()].filter((k) => k.startsWith(prefix));
			return ["0", keys] as [string, string[]];
		}),
		unlink: vi.fn(async (...keys: string[]) => {
			for (const k of keys) store.delete(k);
			return keys.length;
		}),
	};
	return { store, fake };
});

vi.mock("../redis-client.js", () => ({ getRedis: () => fake }));

const { getCached, purgeSubdomain, setCached } = await import(
	"../response-cache.js"
);

const entry = {
	status: 200,
	headers: { "content-type": "application/javascript", vary: ["a", "b"] },
	body: Buffer.from("console.log(1)").toString("base64"),
};

beforeEach(() => {
	store.clear();
	vi.clearAllMocks();
});

describe("response-cache", () => {
	test("round-trips an entry (including array-valued headers)", async () => {
		await setCached("app", "/index.js", "gzip", entry, 60);
		expect(await getCached("app", "/index.js", "gzip")).toEqual(entry);
	});

	test("isolates entries by subdomain (no cross-tenant serve)", async () => {
		await setCached("app-a", "/index.js", "gzip", entry, 60);
		expect(await getCached("app-b", "/index.js", "gzip")).toBeNull();
	});

	test("isolates entries by encoding variant", async () => {
		await setCached("app", "/index.js", "gzip", entry, 60);
		expect(await getCached("app", "/index.js", "identity")).toBeNull();
		expect(await getCached("app", "/index.js", "gzip")).toEqual(entry);
	});

	test("miss returns null", async () => {
		expect(await getCached("app", "/missing.js", "identity")).toBeNull();
	});

	test("does not write when ttl <= 0", async () => {
		await setCached("app", "/x.js", "gzip", entry, 0);
		expect(fake.set).not.toHaveBeenCalled();
	});

	test("purgeSubdomain removes all of a subdomain's variants only", async () => {
		await setCached("app", "/a.js", "gzip", entry, 60);
		await setCached("app", "/a.js", "identity", entry, 60);
		await setCached("other", "/a.js", "gzip", entry, 60);

		await purgeSubdomain("app");

		expect(await getCached("app", "/a.js", "gzip")).toBeNull();
		expect(await getCached("app", "/a.js", "identity")).toBeNull();
		expect(await getCached("other", "/a.js", "gzip")).toEqual(entry);
		expect(fake.unlink).toHaveBeenCalled();
	});
});
