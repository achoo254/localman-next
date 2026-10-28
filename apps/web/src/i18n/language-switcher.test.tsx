import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../app-providers";
import { resetCurrentUserCache } from "../features/auth/use-current-user";
import { LEGACY_LOCALE_KEY } from "../lib/shared-preferences";
import { routes } from "../routes";
import { seriousViolations } from "../test/axe";
import { makeUser } from "../test/fixtures";
import { type MockRoute, UNAUTHENTICATED, mockFetch } from "../test/mock-fetch";
import { createTestQueryClient } from "../test/render-app";
import { readStoredLocale } from "./locale-preference";
import { USER_LOCALE_PATH } from "./save-user-locale";

const SIGNED_IN: Record<string, MockRoute> = {
	"GET /api/v1/users/me": { body: makeUser() },
	"GET /api/v1/notifications": {
		body: { items: [], nextCursor: null, unreadCount: 0 },
	},
	"GET /api/v1/projects": { body: { items: [] } },
};

/** The app at `path` (query string included) under the real providers. */
function renderApp(path: string, api: Record<string, MockRoute>) {
	window.history.replaceState(null, "", path);
	const fetched = mockFetch(api);
	const router = createMemoryRouter(routes, { initialEntries: [path] });
	render(
		<AppProviders queryClient={createTestQueryClient()}>
			<RouterProvider router={router} />
		</AppProviders>,
	);
	return fetched;
}

async function openSwitcher(dataId: string) {
	const trigger = await waitFor(() => {
		const element = document.querySelector(`[data-id="${dataId}"]`);
		if (!(element instanceof HTMLElement)) throw new Error(`no ${dataId}`);
		return element;
	});
	act(() => trigger.focus());
	await userEvent.keyboard("{Enter}");
	return screen.findByRole("menu");
}

const heroHeading = () => screen.findByRole("heading", { level: 1 });

describe("interface language", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		window.localStorage.clear();
		window.history.replaceState(null, "", "/");
		document.documentElement.lang = "en";
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("is English on a first visit, with <html lang='en'>", async () => {
		renderApp("/", { "GET /api/v1/users/me": UNAUTHENTICATED });
		expect(await heroHeading()).toHaveTextContent(/^Stateful mock REST APIs/);
		expect(document.documentElement.lang).toBe("en");
		// The footer pill, as on the account app: each language in itself.
		const pill = screen.getByRole("group", { name: "Language" });
		expect(
			within(pill)
				.getAllByRole("button")
				.map((button) => [button.textContent, button.lang]),
		).toEqual([
			["English", "en"],
			["中文", "zh-CN"],
			["Tiếng Việt", "vi"],
		]);
		expect(
			within(pill).getByRole("button", { name: "English" }),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("follows the browser's language on a first visit", async () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("vi-VN");
		renderApp("/", { "GET /api/v1/users/me": UNAUTHENTICATED });
		await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
		expect(await heroHeading()).toHaveTextContent(/có trạng thái/);
	});

	it("follows a language picked in another hoandat.com app when the page is back in view", async () => {
		renderApp("/", { "GET /api/v1/users/me": UNAUTHENTICATED });
		await heroHeading();
		expect(document.documentElement.lang).toBe("en");
		document.cookie = "hd_lang=zh-CN; Path=/";
		act(() => {
			window.dispatchEvent(new Event("focus"));
		});
		await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
	});

	it("restores the saved language", async () => {
		window.localStorage.setItem(LEGACY_LOCALE_KEY, "vi");
		renderApp("/", { "GET /api/v1/users/me": UNAUTHENTICATED });
		await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
		expect(await heroHeading()).toHaveTextContent(/có trạng thái/);
	});

	it("follows ?lang=zh-CN and remembers it", async () => {
		renderApp("/?lang=zh-CN", { "GET /api/v1/users/me": UNAUTHENTICATED });
		await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
		expect(await heroHeading()).toHaveTextContent(/带状态/);
		expect(readStoredLocale()).toBe("zh-CN");
	});

	it("switches from the footer pill, without calling the API anonymously", async () => {
		const { calls } = renderApp("/", {
			"GET /api/v1/users/me": UNAUTHENTICATED,
		});
		await heroHeading();
		const pill = screen.getByRole("group", { name: "Language" });
		expect(await seriousViolations(document.body)).toEqual([]);
		await userEvent.click(
			within(pill).getByRole("button", { name: "Tiếng Việt" }),
		);
		await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
		expect(await heroHeading()).toHaveTextContent(/có trạng thái/);
		expect(
			screen.getByRole("link", { name: "Bỏ qua tới nội dung" }),
		).toBeInTheDocument();
		expect(readStoredLocale()).toBe("vi");
		expect(calls.some((call) => call.path === USER_LOCALE_PATH)).toBe(false);
	});

	it("saves a signed-in user's choice on the account", async () => {
		const { calls } = renderApp("/projects", {
			...SIGNED_IN,
			[`PUT ${USER_LOCALE_PATH}`]: { status: 204 },
		});
		const menu = await openSwitcher("topbar-language");
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: "中文" }),
		);
		await waitFor(() =>
			expect(
				calls.find((call) => call.path === USER_LOCALE_PATH)?.body,
			).toEqual({ locale: "zh-CN" }),
		);
		expect(calls.find((call) => call.path === USER_LOCALE_PATH)?.method).toBe(
			"PUT",
		);
		await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
	});

	it("keeps quiet while the API has no locale operation yet (404)", async () => {
		renderApp("/projects", SIGNED_IN);
		const menu = await openSwitcher("topbar-language");
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: "Tiếng Việt" }),
		);
		await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
		expect(screen.queryByText(/Không lưu được ngôn ngữ/)).toBeNull();
	});

	it("says so, in the new language, when saving fails", async () => {
		renderApp("/projects", {
			...SIGNED_IN,
			[`PUT ${USER_LOCALE_PATH}`]: {
				status: 500,
				body: { error: { code: "INTERNAL", message: "boom" } },
			},
		});
		const menu = await openSwitcher("topbar-language");
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: "中文" }),
		);
		expect(
			await screen.findByText(
				"未能将语言保存到账号。当前浏览器仍会使用所选语言。",
			),
		).toBeInTheDocument();
		expect(readStoredLocale()).toBe("zh-CN");
	});
});
