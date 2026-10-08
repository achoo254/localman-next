import type http from "node:http";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { StreamSink } from "../../stream/stream-registry.js";

// Small object cap so the over-cap path is easy to exercise.
process.env.CACHE_MAX_OBJECT_BYTES = "5";

const { getCachedMock, setCachedMock } = vi.hoisted(() => ({
	getCachedMock: vi.fn(),
	setCachedMock: vi.fn(),
}));

vi.mock("../response-cache.js", () => ({
	getCached: getCachedMock,
	setCached: setCachedMock,
}));

const { tryServeFromCache, wrapForCache } = await import("../caching-sink.js");

function recorderSink() {
	const calls = {
		status: 0,
		headers: {} as Record<string, string | string[]>,
		data: [] as Buffer[],
		ended: false,
		error: undefined as Error | undefined,
	};
	const sink: StreamSink = {
		onStart(status, headers) {
			calls.status = status;
			calls.headers = headers;
		},
		onData(chunk) {
			calls.data.push(chunk);
		},
		onEnd() {
			calls.ended = true;
		},
		onError(err) {
			calls.error = err;
		},
	};
	return { sink, calls };
}

function fakeRes(throwOnWrite = false) {
	return {
		writableEnded: false,
		destroyed: false,
		status: 0,
		headers: {} as Record<string, unknown>,
		body: undefined as Buffer | undefined,
		writeHead(status: number, headers: Record<string, unknown>) {
			if (throwOnWrite) throw new Error("ERR_INVALID_CHAR");
			this.status = status;
			this.headers = headers;
		},
		end(body?: Buffer) {
			this.body = body;
			this.writableEnded = true;
		},
	};
}

const cacheableHeaders = {
	"content-type": "application/javascript",
	"content-length": "3",
	"cache-control": "public, max-age=3600",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("tryServeFromCache", () => {
	test("serves a hit with X-Tunelo-Cache: HIT and returns bytes", async () => {
		getCachedMock.mockResolvedValue({
			status: 200,
			headers: { "content-type": "application/javascript" },
			body: Buffer.from("abc").toString("base64"),
		});
		const res = fakeRes();
		const bytes = await tryServeFromCache(
			res as unknown as http.ServerResponse,
			"app",
			"/a.js",
			"GET",
			false,
			"gzip",
		);
		expect(bytes).toBe(3);
		expect(res.status).toBe(200);
		expect(res.headers["x-tunelo-cache"]).toBe("HIT");
		expect(res.body?.toString()).toBe("abc");
	});

	test("returns null (no crash) when writing a poisoned entry throws", async () => {
		getCachedMock.mockResolvedValue({
			status: 200,
			headers: { "bad\nheader": "x" },
			body: Buffer.from("abc").toString("base64"),
		});
		const res = fakeRes(true);
		await expect(
			tryServeFromCache(
				res as unknown as http.ServerResponse,
				"app",
				"/a.js",
				"GET",
				false,
				"gzip",
			),
		).resolves.toBeNull();
	});

	test("returns null (no lookup) for non-GET", async () => {
		const res = fakeRes();
		const bytes = await tryServeFromCache(
			res as unknown as http.ServerResponse,
			"app",
			"/a.js",
			"POST",
			false,
			"gzip",
		);
		expect(bytes).toBeNull();
		expect(getCachedMock).not.toHaveBeenCalled();
	});

	test("returns null (no lookup) for API paths", async () => {
		const res = fakeRes();
		await tryServeFromCache(
			res as unknown as http.ServerResponse,
			"app",
			"/api/users",
			"GET",
			false,
			"gzip",
		);
		expect(getCachedMock).not.toHaveBeenCalled();
	});

	test("returns null on a miss", async () => {
		getCachedMock.mockResolvedValue(null);
		const res = fakeRes();
		expect(
			await tryServeFromCache(
				res as unknown as http.ServerResponse,
				"app",
				"/a.js",
				"GET",
				false,
				"gzip",
			),
		).toBeNull();
	});
});

describe("wrapForCache", () => {
	test("passes non-GET through untouched (identity)", () => {
		const { sink } = recorderSink();
		expect(wrapForCache(sink, "app", "/a.js", "POST", false, "gzip")).toBe(
			sink,
		);
	});

	test("tees a cacheable response into the cache and tags MISS", () => {
		const { sink, calls } = recorderSink();
		const wrapped = wrapForCache(sink, "app", "/a.js", "GET", false, "gzip");
		wrapped.onStart(200, { ...cacheableHeaders });
		wrapped.onData(Buffer.from("abc"));
		wrapped.onEnd();

		expect(calls.headers["x-tunelo-cache"]).toBe("MISS");
		expect(calls.data[0]?.toString()).toBe("abc");
		expect(calls.ended).toBe(true);
		expect(setCachedMock).toHaveBeenCalledTimes(1);
		const [sub, path, variant, entry, ttl] = setCachedMock.mock.calls[0];
		expect(sub).toBe("app");
		expect(path).toBe("/a.js");
		expect(variant).toBe("gzip");
		expect(entry.body).toBe(Buffer.from("abc").toString("base64"));
		expect(ttl).toBe(3600);
	});

	test("does not cache a non-cacheable response and tags BYPASS", () => {
		const { sink, calls } = recorderSink();
		const wrapped = wrapForCache(sink, "app", "/data", "GET", false, "gzip");
		wrapped.onStart(200, {
			"content-type": "application/json",
			"content-length": "3",
		});
		wrapped.onData(Buffer.from("abc"));
		wrapped.onEnd();

		expect(calls.headers["x-tunelo-cache"]).toBe("BYPASS");
		expect(setCachedMock).not.toHaveBeenCalled();
	});

	test("abandons caching when body exceeds the object cap", () => {
		const { sink } = recorderSink();
		const wrapped = wrapForCache(sink, "app", "/big.js", "GET", false, "gzip");
		wrapped.onStart(200, { ...cacheableHeaders, "content-length": "8" });
		wrapped.onData(Buffer.from("abcdefgh")); // 8 bytes > cap of 5
		wrapped.onEnd();
		expect(setCachedMock).not.toHaveBeenCalled();
	});

	test("does not cache on error", () => {
		const { sink, calls } = recorderSink();
		const wrapped = wrapForCache(sink, "app", "/a.js", "GET", false, "gzip");
		wrapped.onStart(200, { ...cacheableHeaders });
		wrapped.onError(new Error("boom"));
		expect(calls.error?.message).toBe("boom");
		expect(setCachedMock).not.toHaveBeenCalled();
	});
});
