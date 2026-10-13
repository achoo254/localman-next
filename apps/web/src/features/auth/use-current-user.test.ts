import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../lib/api-client";
import { navigateToLogin } from "../../platform/navigation";
import { makeUser } from "../../test/fixtures";
import { UNAUTHENTICATED, mockFetch } from "../../test/mock-fetch";
import {
	peekCurrentUser,
	reloadCurrentUser,
	resetCurrentUserCache,
} from "./use-current-user";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

describe("current user and the login redirect loop", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("does not reset the loop counter when /users/me succeeds", async () => {
		// Sign-in works, but another API keeps answering 401: each page load
		// is "session OK, then 401, then back to login".
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/projects": UNAUTHENTICATED,
		});
		for (let load = 0; load < 3; load += 1) {
			await reloadCurrentUser();
			await expect(apiRequest("/api/v1/projects")).rejects.toMatchObject({
				status: 401,
			});
		}
		expect(navigateToLogin).toHaveBeenCalledTimes(2);
		expect(
			JSON.parse(
				window.sessionStorage.getItem("localman-login-redirects") ?? "",
			),
		).toMatchObject({ count: 2 });
	});
});

describe("current user and silent sign-in", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		document.cookie = "lm_sso_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("is a guest at once when this browser never signed in", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		await reloadCurrentUser();
		expect(peekCurrentUser()).toEqual({ status: "anonymous" });
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("does not leave when the hint arrived after the probe started", async () => {
		// A sign-in clicked while /users/me is in flight sets the hint on its
		// way back; the probe's late 401 must not start a silent sign-in that
		// would cancel that redirect.
		let answer: (response: Response) => void = () => {};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						answer = resolve;
					}),
			),
		);
		const probe = reloadCurrentUser();
		document.cookie = "lm_sso_hint=1";
		answer(
			new Response(
				JSON.stringify({
					error: { code: "UNAUTHENTICATED", message: "Sign in" },
				}),
				{ status: 401, headers: { "content-type": "application/json" } },
			),
		);
		await probe;
		expect(navigateToLogin).not.toHaveBeenCalled();
		expect(peekCurrentUser()).toEqual({ status: "anonymous" });
	});

	it("stays loading while it leaves for a silent sign-in", async () => {
		document.cookie = "lm_sso_hint=1";
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		await reloadCurrentUser();
		expect(peekCurrentUser()).toEqual({ status: "loading" });
		expect(navigateToLogin).toHaveBeenCalledWith(
			expect.objectContaining({ prompt: "none" }),
		);
	});
});
