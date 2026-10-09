import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../lib/api-client";
import { navigateToLogin } from "../../platform/navigation";
import { makeUser } from "../../test/fixtures";
import { UNAUTHENTICATED, mockFetch } from "../../test/mock-fetch";
import { reloadCurrentUser, resetCurrentUserCache } from "./use-current-user";

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
