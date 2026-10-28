import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetCurrentUserCache,
	useCurrentUser,
} from "../features/auth/use-current-user";
import { LEGACY_LOCALE_KEY } from "../lib/shared-preferences";
import { makeUser } from "../test/fixtures";
import { mockFetch } from "../test/mock-fetch";
import { setActiveTranslator } from "./active-translator";
import { useI18n } from "./i18n-context";
import { I18nProvider } from "./i18n-provider";
import { readStoredLocale } from "./locale-preference";
import { en } from "./messages/en/dictionary";
import { USER_LOCALE_PATH } from "./save-user-locale";
import { createTranslator } from "./translate";

/** Asks for the session (as the app shell does) and shows the language. */
function Probe() {
	useCurrentUser();
	const { locale } = useI18n();
	return <output data-id="locale">{locale}</output>;
}

function shownLocale(container: HTMLElement): string | null | undefined {
	return container.querySelector('[data-id="locale"]')?.textContent;
}

function renderSignedIn(accountLocale: "en" | "vi" | "zh-CN") {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser({ locale: accountLocale }) },
		[`PUT ${USER_LOCALE_PATH}`]: { body: { locale: "zh-CN" } },
	});
	const view = render(
		<I18nProvider>
			<Probe />
		</I18nProvider>,
	);
	return { ...api, ...view };
}

describe("account language sync", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		window.localStorage.clear();
		vi.unstubAllGlobals();
		setActiveTranslator(createTranslator("en", en));
	});

	it("applies the account's language when this browser has no choice", async () => {
		const { container, calls } = renderSignedIn("vi");
		await waitFor(() => expect(shownLocale(container)).toBe("vi"));
		expect(readStoredLocale()).toBe("vi");
		expect(calls.some((call) => call.method === "PUT")).toBe(false);
	});

	it("keeps this browser's choice and saves it on the account", async () => {
		window.localStorage.setItem(LEGACY_LOCALE_KEY, "zh-CN");
		const { container, calls } = renderSignedIn("vi");
		await waitFor(() =>
			expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
				locale: "zh-CN",
			}),
		);
		await waitFor(() => expect(shownLocale(container)).toBe("zh-CN"));
		expect(readStoredLocale()).toBe("zh-CN");
	});

	it("changes nothing when both are the default", async () => {
		const { container, calls } = renderSignedIn("en");
		await waitFor(() =>
			expect(calls.some((call) => call.path === "/api/v1/users/me")).toBe(true),
		);
		expect(shownLocale(container)).toBe("en");
		expect(readStoredLocale()).toBeNull();
		expect(calls.some((call) => call.method === "PUT")).toBe(false);
	});
});
