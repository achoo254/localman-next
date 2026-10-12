import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	peekCurrentUser,
	resetCurrentUserCache,
} from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { seriousViolations } from "../../test/axe";
import { makeUser } from "../../test/fixtures";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

type SessionCase = "loading" | "anonymous" | "authenticated";

const ME: Record<SessionCase, MockRoute> = {
	loading: () => new Promise<never>(() => undefined),
	anonymous: UNAUTHENTICATED,
	authenticated: { body: makeUser() },
};

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

function topbar(): HTMLElement {
	const bar = document.querySelector('header[data-id="topbar"]');
	if (!(bar instanceof HTMLElement)) throw new Error("no top bar");
	return bar;
}

function slot(): HTMLElement {
	const element = topbar().querySelector('[data-id="topbar-account-slot"]');
	if (!(element instanceof HTMLElement)) throw new Error("no account slot");
	return element;
}

function layers(): HTMLElement[] {
	return [...slot().children].filter(
		(child): child is HTMLElement => child instanceof HTMLElement,
	);
}

/** Renders / with the session in `state` and waits until it is reached. */
async function renderLanding(state: SessionCase): Promise<void> {
	mockFetch({
		"GET /api/v1/users/me": ME[state],
		"GET /api/v1/notifications": {
			body: { items: [], nextCursor: null, unreadCount: 0 },
		},
	});
	renderRoutes(routes, "/");
	await screen.findByRole("heading", { level: 1 });
	await waitFor(() => expect(peekCurrentUser().status).toBe(state));
	if (state === "authenticated") {
		await waitFor(() => expect(slot()).toHaveAttribute("data-view", "account"));
	}
}

describe("account slot of the public top bar", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		// axe probes fonts through canvas, which jsdom lacks.
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it.each<[SessionCase, "guest" | "account"]>([
		["loading", "guest"],
		["anonymous", "guest"],
		["authenticated", "account"],
	])("lays out both versions in one cell while %s", async (state, shown) => {
		await renderLanding(state);
		expect(slot()).toHaveClass("grid");
		expect(slot()).toHaveAttribute("data-view", shown);
		// Same two layers, same order, same grid cell, whatever the session:
		// the slot is always as wide as the wider version.
		expect(
			layers().map((layer) => [
				layer.dataset.version,
				layer.dataset.layer,
				layer.classList.contains("col-start-1") &&
					layer.classList.contains("row-start-1"),
			]),
		).toEqual([
			["guest", shown === "guest" ? "active" : "spacer", true],
			["account", shown === "account" ? "active" : "spacer", true],
		]);
		// A spacer carries the same words as the version it stands for.
		expect(layers().map((layer) => layer.textContent)).toEqual([
			"Sign inGet startedGet started now",
			"Open app",
		]);
	});

	it.each<SessionCase>(["loading", "anonymous", "authenticated"])(
		"keeps the hidden version out of focus and the accessibility tree while %s",
		async (state) => {
			await renderLanding(state);
			const spacers = layers().filter(
				(layer) => layer.dataset.layer === "spacer",
			);
			expect(spacers).toHaveLength(1);
			for (const spacer of spacers) {
				expect(spacer).toHaveAttribute("aria-hidden", "true");
				expect(spacer).toHaveAttribute("inert");
				expect(spacer).toHaveClass("invisible");
				expect(spacer.querySelectorAll(FOCUSABLE)).toHaveLength(0);
			}
			// Walking the whole top bar by keyboard never lands in a spacer.
			const stops = topbar().querySelectorAll(FOCUSABLE).length;
			for (let step = 0; step <= stops + 1; step += 1) {
				await userEvent.tab();
				for (const spacer of spacers) {
					expect(spacer).not.toContainElement(
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null,
					);
				}
			}
		},
	);

	it.each<SessionCase>(["loading", "anonymous", "authenticated"])(
		"has no serious axe violations in the top bar while %s",
		async (state) => {
			await renderLanding(state);
			expect(await seriousViolations(topbar())).toEqual([]);
		},
	);

	it("shows the avatar without the name next to Open app", async () => {
		await renderLanding("authenticated");
		const bar = within(topbar());
		const account = bar.getByRole("button", { name: "Minh Anh · Account" });
		expect(account).not.toHaveTextContent("Minh Anh");
		expect(bar.getByRole("link", { name: "Open app" })).toHaveAttribute(
			"href",
			"/projects",
		);
	});
});
