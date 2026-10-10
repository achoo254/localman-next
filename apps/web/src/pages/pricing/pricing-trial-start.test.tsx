import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../../features/auth/current-user";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	freezeTrialClock,
	trialUser,
} from "../../features/subscription/trial-test-helpers";
import { navigateToLogin } from "../../platform/navigation";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { findToast } from "../../test/toast";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

const START = "POST /api/v1/users/me/trial";

function api(user: CurrentUser, extra: Record<string, MockRoute> = {}) {
	return mockFetch({
		"GET /api/v1/users/me": { body: user },
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
		...extra,
	});
}

const conflict = (code: string): MockRoute => ({
	status: 409,
	body: { error: { code, message: "Conflict." } },
});

beforeEach(() => {
	resetCurrentUserCache();
	freezeTrialClock();
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	// axe probes fonts through canvas, which jsdom lacks.
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.mocked(navigateToLogin).mockClear();
});

describe("starting the Pro trial from /pricing", () => {
	it("sends a visitor through sign-in with the trial to resume", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/pricing");
		await userEvent.click(
			await screen.findByRole("link", { name: "Start free trial" }),
		);
		expect(navigateToLogin).toHaveBeenCalledWith({
			returnTo: "/pricing?trial=start",
			prompt: undefined,
		});
	});

	it("opens the confirmation on return from sign-in, then starts the trial", async () => {
		const { calls } = api(trialUser("available"), {
			[START]: { body: trialUser("active") },
		});
		const { router, container } = renderRoutes(routes, "/pricing?trial=start");
		const dialog = await screen.findByRole("dialog", {
			name: "Start your Pro trial",
		});
		expect(router.state.location.search).toBe("");
		expect(dialog).toHaveTextContent("Get Pro for 30 days, until Nov 9, 2026.");
		expect(dialog).toHaveTextContent("only once");
		expect(await seriousViolations(container.ownerDocument.body)).toEqual([]);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Start trial" }),
		);
		expect(
			await findToast("Your Pro trial has started. It ends on Oct 22, 2026."),
		).toBeVisible();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(
			document.querySelector('[data-id="pricing-card-pro-cta"]'),
		).toHaveTextContent("Trial ends in 12 days");
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
	});

	it("does not ask again when the trial was already used", async () => {
		api(trialUser("used"));
		const { router } = renderRoutes(routes, "/pricing?trial=start");
		await waitFor(() => expect(router.state.location.search).toBe(""));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			document.querySelector('[data-id="pricing-card-pro-cta"]'),
		).toHaveTextContent("Trial used");
	});

	it("keeps the button busy while the trial starts", async () => {
		api(trialUser("available"), {
			[START]: () => new Promise<never>(() => undefined),
		});
		renderRoutes(routes, "/pricing");
		await userEvent.click(
			await screen.findByRole("button", { name: "Start 30-day trial" }),
		);
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", { name: "Start trial" });
		await userEvent.click(confirm);
		expect(confirm).toHaveAttribute("aria-busy", "true");
	});

	it.each([
		[
			"TRIAL_ALREADY_USED",
			"This account has already used its Pro trial. You can request an extension from your account page.",
		],
		[
			"ALREADY_PRO",
			"Your account is already on Pro, so there's no trial to start.",
		],
	])("explains a %s refusal and refreshes the session", async (code, text) => {
		const { calls } = api(trialUser("available"), { [START]: conflict(code) });
		renderRoutes(routes, "/pricing");
		await userEvent.click(
			await screen.findByRole("button", { name: "Start 30-day trial" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Start trial" }),
		);
		expect(await within(dialog).findByText(text)).toBeVisible();
		await waitFor(() =>
			expect(
				calls.filter((call) => call.path === "/api/v1/users/me"),
			).toHaveLength(2),
		);
	});
});
