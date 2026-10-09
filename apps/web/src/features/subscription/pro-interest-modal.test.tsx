import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTurnstile, resetFakeTurnstile } from "../../test/fake-turnstile";
import { makeUser } from "../../test/fixtures";
import {
	type MockRoute,
	UNAUTHENTICATED,
	mockFetch,
} from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { ProInterestModal } from "./pro-interest-modal";
import type { ProInterestSource } from "./pro-interest-options";

vi.mock("../../platform/turnstile", async () => {
	const fake = await import("../../test/fake-turnstile");
	return fake.turnstileModule;
});

const CREATED = { status: 201, body: { received: true } };

function renderModal(
	routes: Record<string, MockRoute>,
	source: ProInterestSource = "landing",
) {
	const api = mockFetch(routes);
	renderRoutes(
		[
			{
				path: "*",
				element: (
					<ProInterestModal open onOpenChange={() => {}} source={source} />
				),
			},
		],
		"/",
	);
	return api;
}

async function fillRequired({ email }: { email?: string } = {}) {
	if (email !== undefined) {
		await userEvent.type(screen.getByLabelText(/^Email/), email);
	}
	await userEvent.type(screen.getByLabelText(/^Name/), "Lan");
	await userEvent.click(screen.getByRole("checkbox", { name: "Team" }));
	await userEvent.click(screen.getByRole("radio", { name: "2–5" }));
}

const consent = () =>
	screen.getByRole("checkbox", {
		name: /I agree that Localman may store my email/,
	});

describe("ProInterestModal", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		resetFakeTurnstile();
	});

	it("asks visitors for Turnstile and sends its token", async () => {
		const { calls } = renderModal({
			"GET /api/v1/users/me": UNAUTHENTICATED,
			"GET /api/v1/feedback/pro-interest/config": {
				body: { turnstileSiteKey: "site-key" },
			},
			"POST /api/v1/feedback/pro-interest": CREATED,
		});
		await waitFor(() =>
			expect(fakeTurnstile.render).toHaveBeenCalledWith(
				expect.any(HTMLElement),
				"site-key",
				expect.anything(),
			),
		);
		expect(screen.getByLabelText(/^Email/)).toHaveValue("");
		expect(screen.getByLabelText(/^Email/)).toHaveFocus();
		const honeypot = document.querySelector(
			'[data-id="pro-interest-honeypot"]',
		);
		expect(honeypot).toHaveAttribute("name", "contact_extra");
		expect(honeypot).toHaveAttribute("autocomplete", "off");
		expect(honeypot).toHaveAttribute("tabindex", "-1");
		await fillRequired({ email: "lan@example.com" });
		await userEvent.click(consent());
		await userEvent.click(screen.getByRole("button", { name: "Send request" }));
		expect(await screen.findByText("Got it")).toBeInTheDocument();
		expect(screen.getByText("lan@example.com")).toBeInTheDocument();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			email: "lan@example.com",
			name: "Lan",
			needs: ["team"],
			teamSize: "2-5",
			source: "landing",
			consent: true,
			turnstileToken: "turnstile-token",
			website: "",
		});
	});

	it("prefills the account email for signed-in users and skips Turnstile", async () => {
		const { calls } = renderModal(
			{
				"GET /api/v1/users/me": { body: makeUser() },
				"POST /api/v1/feedback/pro-interest": CREATED,
			},
			"plan_limit_projects",
		);
		const email = await screen.findByLabelText(/^Email/);
		await waitFor(() => expect(email).toHaveValue("minhanh@example.com"));
		expect(email).toHaveAccessibleDescription(
			"Taken from your account. You can change it.",
		);
		// The email is already there, so the name comes first.
		await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveFocus());
		// The need behind the project limit is pre-ticked.
		expect(screen.getByRole("checkbox", { name: "Mock API" })).toBeChecked();
		await userEvent.clear(email);
		await userEvent.type(email, "work@example.com");
		await fillRequired();
		await userEvent.click(consent());
		await userEvent.click(screen.getByRole("button", { name: "Send request" }));
		await screen.findByText("Got it");
		expect(fakeTurnstile.render).not.toHaveBeenCalled();
		expect(
			calls.some((c) => c.path === "/api/v1/feedback/pro-interest/config"),
		).toBe(false);
		expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
			email: "work@example.com",
			needs: ["mock", "team"],
			source: "plan_limit_projects",
		});
	});

	it("does not send without consent", async () => {
		const { calls } = renderModal({
			"GET /api/v1/users/me": { body: makeUser() },
		});
		await screen.findByLabelText(/^Email/);
		await fillRequired();
		await userEvent.click(screen.getByRole("button", { name: "Send request" }));
		expect(
			screen.getByText(
				"We need your consent to store your email and contact you.",
			),
		).toBeInTheDocument();
		expect(consent()).toHaveAttribute("aria-invalid", "true");
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});

	it("shows Vietnamese messages for API error codes and keeps the form", async () => {
		renderModal({
			"GET /api/v1/users/me": { body: makeUser() },
			"POST /api/v1/feedback/pro-interest": {
				status: 429,
				body: { error: { code: "RATE_LIMITED", message: "Too many" } },
			},
		});
		await screen.findByLabelText(/^Email/);
		await fillRequired();
		await userEvent.click(consent());
		await userEvent.click(screen.getByRole("button", { name: "Send request" }));
		expect(
			await screen.findByText(
				"You've sent this too many times. Wait a moment and try again.",
			),
		).toBeInTheDocument();
		expect(screen.queryByText("Got it")).toBeNull();
	});
});
