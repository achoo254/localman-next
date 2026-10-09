import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateToLogin } from "../platform/navigation";
import { UNAUTHENTICATED, mockFetch } from "../test/mock-fetch";
import { ApiError, apiRequest, errorMessage } from "./api-client";

vi.mock("../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

describe("apiRequest", () => {
	beforeEach(() => {
		window.history.pushState({}, "", "/projects/demo?tab=resources#log");
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("sends same-origin JSON and returns the parsed body", async () => {
		const { calls } = mockFetch({ "POST /api/v1/things": { body: { ok: 1 } } });
		await expect(
			apiRequest("/api/v1/things", { method: "POST", body: { a: 1 } }),
		).resolves.toEqual({ ok: 1 });
		const [call] = calls;
		expect(call?.body).toEqual({ a: 1 });
		expect(call?.init?.credentials).toBe("same-origin");
		expect(call?.init?.headers).toMatchObject({
			Accept: "application/json",
			"Content-Type": "application/json",
		});
	});

	it("resolves null for an empty success body", async () => {
		mockFetch({ "POST /api/v1/read": { status: 204 } });
		await expect(
			apiRequest("/api/v1/read", { method: "POST" }),
		).resolves.toBeNull();
	});

	it("on 401 sends the user to login with the current page as returnTo", async () => {
		mockFetch({ "GET /api/v1/things": UNAUTHENTICATED });
		await expect(apiRequest("/api/v1/things")).rejects.toMatchObject({
			status: 401,
			code: "UNAUTHENTICATED",
		});
		expect(navigateToLogin).toHaveBeenCalledWith({
			returnTo: "/projects/demo?tab=resources#log",
		});
	});

	it("stops redirecting after two automatic logins within a minute", async () => {
		mockFetch({ "GET /api/v1/things": UNAUTHENTICATED });
		for (let i = 0; i < 3; i += 1) {
			await expect(apiRequest("/api/v1/things")).rejects.toMatchObject({
				status: 401,
			});
		}
		expect(navigateToLogin).toHaveBeenCalledTimes(2);
	});

	it("does not redirect when the caller expects 401", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		await expect(
			apiRequest("/api/v1/users/me", { redirectOnUnauthorized: false }),
		).rejects.toBeInstanceOf(ApiError);
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("maps the error envelope and falls back for non-JSON errors", async () => {
		mockFetch({
			"GET /api/v1/limit": {
				status: 403,
				body: { error: { code: "PLAN_LIMIT", message: "Hết hạn mức." } },
			},
			"GET /api/v1/broken": { status: 502, body: "<html>" },
		});
		await expect(apiRequest("/api/v1/limit")).rejects.toMatchObject({
			status: 403,
			code: "PLAN_LIMIT",
			message: "Hết hạn mức.",
		});
		await expect(apiRequest("/api/v1/broken")).rejects.toMatchObject({
			status: 502,
			code: "HTTP_502",
		});
	});

	it("reports network failures as NETWORK_ERROR", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
		await expect(apiRequest("/api/v1/things")).rejects.toMatchObject({
			status: 0,
			code: "NETWORK_ERROR",
		});
	});
});

describe("errorMessage", () => {
	it("explains a rate limit in Vietnamese instead of the API's English", () => {
		expect(
			errorMessage(new ApiError(429, "RATE_LIMITED", "Too many requests")),
		).toBe("Bạn thao tác quá nhanh. Hãy đợi khoảng một phút rồi thử lại.");
		expect(errorMessage(new ApiError(400, "X", "As sent"))).toBe("As sent");
	});
});
