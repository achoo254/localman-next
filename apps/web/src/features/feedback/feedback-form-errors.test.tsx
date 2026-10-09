import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeTurnstile } from "../../test/fake-turnstile";
import { makeUser } from "../../test/fixtures";
import { UNAUTHENTICATED } from "../../test/mock-fetch";
import {
	CONFIG,
	SUBMIT,
	messageBox,
	openForm,
	send,
	useFeedbackTestSetup,
} from "./feedback-test-helpers";

vi.mock("../../platform/turnstile", async () => {
	const fake = await import("../../test/fake-turnstile");
	return fake.turnstileModule;
});

const SIGNED_IN = { "GET /api/v1/users/me": { body: makeUser() } };

describe("FeedbackForm errors", () => {
	useFeedbackTestSetup();

	it.each([
		[
			429,
			"RATE_LIMITED",
			"Bạn gửi nhiều lần liên tiếp. Đợi vài phút rồi thử lại. Nội dung vẫn còn đây.",
		],
		[503, "UNAVAILABLE", "Chưa gửi được. Nội dung vẫn còn đây, hãy thử lại."],
	])(
		"answers %i with a Vietnamese message and keeps what was typed",
		async (status, code, text) => {
			await openForm({
				...SIGNED_IN,
				[SUBMIT]: { status, body: { error: { code, message: "x" } } },
			});
			await userEvent.type(messageBox(), "Lỗi gì đó");
			await send();
			expect(await screen.findByText(text)).toBeInTheDocument();
			expect(messageBox()).toHaveValue("Lỗi gì đó");
			expect(screen.queryByText("Đã gửi, cảm ơn bạn")).toBeNull();
		},
	);

	it("marks the fields the API refused", async () => {
		await openForm({
			...SIGNED_IN,
			[SUBMIT]: {
				status: 400,
				body: {
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid input",
						details: [{ path: "contact", message: "Invalid" }],
					},
				},
			},
		});
		await userEvent.type(messageBox(), "Xin chào");
		await send();
		const contact = screen.getByLabelText(/^Email hoặc Telegram/);
		await waitFor(() =>
			expect(contact).toHaveAttribute("aria-invalid", "true"),
		);
		expect(contact).toHaveFocus();
		expect(
			screen.getByText(
				"Nhập email hoặc username Telegram hợp lệ, hoặc để trống.",
			),
		).toBeInTheDocument();
	});

	it("reads the session again and asks for Turnstile when it expired", async () => {
		let sessionReads = 0;
		const { calls } = await openForm({
			"GET /api/v1/users/me": () => {
				sessionReads += 1;
				return sessionReads === 1 ? { body: makeUser() } : UNAUTHENTICATED;
			},
			[CONFIG]: { body: { turnstileSiteKey: "site-key" } },
			[SUBMIT]: {
				status: 400,
				body: { error: { code: "TURNSTILE_FAILED", message: "x" } },
			},
		});
		expect(fakeTurnstile.render).not.toHaveBeenCalled();
		await userEvent.type(messageBox(), "Vẫn còn");
		await send();
		expect(
			await screen.findByText(/Phiên đăng nhập đã hết hạn/),
		).toBeInTheDocument();
		await waitFor(() => expect(fakeTurnstile.render).toHaveBeenCalled());
		expect(messageBox()).toHaveValue("Vẫn còn");
		expect(calls.filter((c) => c.path === "/api/v1/users/me")).toHaveLength(2);
	});
});
