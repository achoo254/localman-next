import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { AppFooter } from "../../components/layout/app-footer";
import { resetFakeTurnstile } from "../../test/fake-turnstile";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { resetCurrentUserCache } from "../auth/use-current-user";

export const CREATED = { status: 201, body: { received: true } };
export const SUBMIT = "POST /api/v1/feedback/contact";
export const CONFIG = "GET /api/v1/feedback/pro-interest/config";

/**
 * TEST ONLY. Fresh session cache and Turnstile fake per test; axe needs
 * the canvas stub. Callers still `vi.mock("../../platform/turnstile")`.
 */
export function useFeedbackTestSetup(): void {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		resetFakeTurnstile();
	});
}

/** TEST ONLY. Renders the footer on `path` and opens the form from its link. */
export async function openForm(routes: Record<string, MockRoute>, path = "/") {
	const api = mockFetch(routes);
	renderRoutes([{ path: "*", element: <AppFooter /> }], path);
	expect(api.calls).toHaveLength(0);
	await userEvent.click(
		screen.getByRole("button", { name: "Feedback / Contact" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Feedback / Contact",
	});
	await within(dialog).findByLabelText(/^Message/);
	return { ...api, dialog };
}

export const send = () =>
	userEvent.click(screen.getByRole("button", { name: "Send" }));

export const messageBox = () => screen.getByLabelText(/^Message/);
