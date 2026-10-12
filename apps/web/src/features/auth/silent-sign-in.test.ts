import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateToLogin } from "../../platform/navigation";
import { trySilentSignIn } from "./silent-sign-in";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

describe("silent sign-in", () => {
	afterEach(() => vi.mocked(navigateToLogin).mockClear());

	it.each(["__Host-lm_sso_hint=1", "theme=dark; lm_sso_hint=1"])(
		"leaves for prompt=none with the hint cookie (%s)",
		(cookies) => {
			window.history.replaceState(null, "", "/docs?tab=mcp#setup");
			expect(trySilentSignIn(cookies, "")).toBe(true);
			expect(navigateToLogin).toHaveBeenCalledWith({
				returnTo: "/docs?tab=mcp#setup",
				prompt: "none",
			});
		},
	);

	it.each([
		["a browser that never signed in", "", ""],
		["a lookalike cookie name", "xlm_sso_hint=1", ""],
		[
			"an attempt in the last minute",
			"lm_sso_hint=1; __Host-lm_sso_tried=1",
			"",
		],
		["a page reporting a failed sign-in", "lm_sso_hint=1", "?authError=x"],
	])("stays for %s", (_case, cookies, search) => {
		expect(trySilentSignIn(cookies, search)).toBe(false);
		expect(navigateToLogin).not.toHaveBeenCalled();
	});
});
