import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { fakeTurnstile } from "../../test/fake-turnstile";
import { makeUser } from "../../test/fixtures";
import { UNAUTHENTICATED } from "../../test/mock-fetch";
import {
	CONFIG,
	CREATED,
	SUBMIT,
	openForm,
	send,
	useFeedbackTestSetup,
} from "./feedback-test-helpers";

vi.mock("../../platform/turnstile", async () => {
	const fake = await import("../../test/fake-turnstile");
	return fake.turnstileModule;
});

describe("FeedbackForm", () => {
	useFeedbackTestSetup();

	it("sends a visitor's message with the Turnstile token and announces the result", async () => {
		const { calls, dialog } = await openForm({
			"GET /api/v1/users/me": UNAUTHENTICATED,
			[CONFIG]: {
				body: { turnstileSiteKey: "site-key" },
			},
			[SUBMIT]: CREATED,
		});
		// The widget declares this form's action; the API refuses other ones.
		await waitFor(() =>
			expect(fakeTurnstile.render).toHaveBeenCalledWith(
				expect.any(HTMLElement),
				"site-key",
				expect.objectContaining({ action: "contact" }),
			),
		);
		await waitFor(() =>
			expect(screen.getByLabelText(/^Message/)).toHaveFocus(),
		);
		expect(
			screen.getByText(
				"Feedback is sent with the area you have open (for example the home page), not the page address.",
			),
		).toBeVisible();
		await userEvent.selectOptions(screen.getByLabelText("Type"), "bug");
		expect(screen.getByLabelText(/^Message/)).toHaveAttribute(
			"placeholder",
			"What were you doing when it went wrong, and what did you see?",
		);
		await userEvent.type(
			screen.getByLabelText(/^Message/),
			"  Nút Lưu không chạy  ",
		);
		await userEvent.type(
			screen.getByLabelText(/^Email or Telegram/),
			"@lan_dev",
		);
		await send();
		const result = dialog.querySelector('[data-id="modal-feedback-result"]');
		expect(result).toHaveAttribute("aria-live", "polite");
		await waitFor(() => expect(result).toHaveTextContent("Sent. Thank you"));
		expect(result).toHaveTextContent("We'll reply via @lan_dev if needed.");
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			category: "bug",
			message: "Nút Lưu không chạy",
			contact: "@lan_dev",
			source: "landing",
			turnstileToken: "turnstile-token",
			website: "",
		});
	});

	it("prefills a signed-in user's name and email, skips Turnstile and sends the app area, not the path", async () => {
		const { calls } = await openForm(
			{
				"GET /api/v1/users/me": { body: makeUser() },
				[SUBMIT]: CREATED,
			},
			"/projects/p-123",
		);
		expect(screen.getByLabelText(/^Name/)).toHaveValue("Minh Anh");
		const contact = screen.getByLabelText(/^Email or Telegram/);
		expect(contact).toHaveValue("minhanh@example.com");
		expect(contact).toHaveAccessibleDescription("Taken from your account.");
		expect(
			screen.getByText(
				"Feedback is sent with your account and the area you have open (for example Projects), not the page address.",
			),
		).toBeVisible();
		await userEvent.clear(contact);
		await userEvent.type(screen.getByLabelText(/^Message/), "Hay lắm");
		await send();
		const done = await screen.findByText(/We've received your message/);
		expect(done).not.toHaveTextContent("reply via");
		expect(fakeTurnstile.render).not.toHaveBeenCalled();
		expect(calls.some((c) => c.path.endsWith("/config"))).toBe(false);
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			category: "feedback",
			message: "Hay lắm",
			name: "Minh Anh",
			source: "projects",
			website: "",
		});
	});

	it("checks the fields before sending", async () => {
		const { calls } = await openForm({
			"GET /api/v1/users/me": { body: makeUser() },
		});
		const contact = screen.getByLabelText(/^Email or Telegram/);
		await userEvent.clear(contact);
		await userEvent.type(contact, "không phải địa chỉ");
		await send();
		const message = screen.getByLabelText(/^Message/);
		expect(message).toHaveAttribute("aria-invalid", "true");
		expect(message).toHaveFocus();
		expect(screen.getByText("Enter a message.")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Enter a valid email or Telegram username, or leave it empty.",
			),
		).toBeInTheDocument();
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});

	it("hides the honeypot from people and assistive tech, with no axe violations", async () => {
		const { dialog } = await openForm({
			"GET /api/v1/users/me": { body: makeUser() },
		});
		const honeypot = dialog.querySelector(
			'[data-id="modal-feedback-honeypot"]',
		);
		expect(honeypot).toHaveAttribute("tabindex", "-1");
		expect(honeypot).toHaveAttribute("autocomplete", "off");
		expect(
			honeypot?.parentElement?.closest('[aria-hidden="true"]'),
		).toHaveClass("sr-only");
		expect(
			within(dialog).queryByRole("textbox", { name: /Leave this field empty/ }),
		).toBeNull();
		expect(within(dialog).getAllByRole("textbox")).toHaveLength(3);
		expect(await seriousViolations(dialog)).toEqual([]);
	});
});
