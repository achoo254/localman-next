import { afterEach, describe, expect, it, vi } from "vitest";
import { setActiveTranslator } from "../i18n/active-translator";
import { en } from "../i18n/messages/en/dictionary";
import { createTranslator } from "../i18n/translate";
import { navigateToLogin } from "./navigation";

describe("navigateToLogin", () => {
	afterEach(() => {
		setActiveTranslator(createTranslator("en", en));
		vi.unstubAllGlobals();
	});

	function stubLocation(): ReturnType<typeof vi.fn> {
		const assign = vi.fn();
		vi.stubGlobal("location", { ...window.location, assign });
		return assign;
	}

	it("signs in with the language on screen", () => {
		const assign = stubLocation();
		// The dictionary only matters for t(); the locale is what is sent.
		setActiveTranslator(createTranslator("vi", en));
		navigateToLogin({ returnTo: "/projects" });
		expect(assign).toHaveBeenCalledWith(
			"/auth/login?returnTo=%2Fprojects&locale=vi",
		);
	});

	it("lets the caller pick the language", () => {
		const assign = stubLocation();
		navigateToLogin({ locale: "zh-CN" });
		expect(assign).toHaveBeenCalledWith("/auth/login?locale=zh-CN");
	});
});
