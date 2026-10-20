import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { routes } from "../../routes";
import { UNAUTHENTICATED, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

/** A visitor without a session (no silent sign-in hint either). */
function renderAsGuest(path: string) {
	mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
	renderRoutes(routes, path);
}

describe("public legal pages", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("serves the privacy policy to a guest, with the domain's names", async () => {
		renderAsGuest("/privacy");
		expect(
			await screen.findByRole("heading", { level: 1, name: "Privacy Policy" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Who else receives data" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "auth.hoandat.com" }),
		).toHaveAttribute("href", expect.stringContaining("auth.hoandat.com"));
		expect(
			screen.getByRole("link", { name: "What deletion removes" }),
		).toHaveAttribute("href", "/account/delete");
	});

	it("serves the terms to a guest", async () => {
		renderAsGuest("/terms");
		expect(
			await screen.findByRole("heading", { level: 1, name: "Terms of Use" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Privacy Policy" }),
		).toHaveAttribute("href", "/privacy");
	});

	it("explains account deletion at a stable public address", async () => {
		renderAsGuest("/account/delete");
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Delete your Localman account",
			}),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Go to Account" })).toHaveAttribute(
			"href",
			"/account",
		);
		expect(
			screen.getByRole("link", { name: "your hoandat account page" }),
		).toHaveAttribute("href", expect.stringMatching(/\/account\/delete$/));
		expect(
			document.querySelector('[data-id="legal-account-deleted"]'),
		).toBeNull();
	});

	it("confirms a deletion that just happened", async () => {
		renderAsGuest("/account/delete?deleted=1");
		expect(
			await screen.findByText(/Your Localman account was deleted/),
		).toBeInTheDocument();
	});

	it("links every legal page from the footer", async () => {
		renderAsGuest("/terms");
		await screen.findByRole("heading", { level: 1, name: "Terms of Use" });
		const footer = document.querySelector('[data-id="app-footer-legal"]');
		expect(footer?.querySelectorAll("a")).toHaveLength(3);
		expect(
			[...(footer?.querySelectorAll("a") ?? [])].map((a) =>
				a.getAttribute("href"),
			),
		).toEqual(["/privacy", "/terms", "/account/delete"]);
	});
});
