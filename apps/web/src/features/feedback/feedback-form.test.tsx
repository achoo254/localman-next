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
			expect(screen.getByLabelText(/^Nội dung/)).toHaveFocus(),
		);
		expect(
			screen.getByText(
				"Góp ý gửi kèm khu vực bạn đang mở (ví dụ trang chủ), không kèm đường dẫn.",
			),
		).toBeVisible();
		await userEvent.selectOptions(screen.getByLabelText("Loại"), "bug");
		expect(screen.getByLabelText(/^Nội dung/)).toHaveAttribute(
			"placeholder",
			"Bạn đang làm gì thì gặp lỗi, và lỗi hiện ra thế nào?",
		);
		await userEvent.type(
			screen.getByLabelText(/^Nội dung/),
			"  Nút Lưu không chạy  ",
		);
		await userEvent.type(
			screen.getByLabelText(/^Email hoặc Telegram/),
			"@lan_dev",
		);
		await send();
		const result = dialog.querySelector('[data-id="modal-feedback-result"]');
		expect(result).toHaveAttribute("aria-live", "polite");
		await waitFor(() => expect(result).toHaveTextContent("Đã gửi, cảm ơn bạn"));
		expect(result).toHaveTextContent(
			"Chúng tôi sẽ trả lời qua @lan_dev nếu cần.",
		);
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
		expect(screen.getByLabelText(/^Tên/)).toHaveValue("Minh Anh");
		const contact = screen.getByLabelText(/^Email hoặc Telegram/);
		expect(contact).toHaveValue("minhanh@example.com");
		expect(contact).toHaveAccessibleDescription("Lấy từ tài khoản của bạn.");
		expect(
			screen.getByText(
				"Góp ý gửi kèm tài khoản của bạn và khu vực bạn đang mở (ví dụ Projects), không kèm đường dẫn.",
			),
		).toBeVisible();
		await userEvent.clear(contact);
		await userEvent.type(screen.getByLabelText(/^Nội dung/), "Hay lắm");
		await send();
		const done = await screen.findByText(/Chúng tôi đã nhận được tin của bạn/);
		expect(done).not.toHaveTextContent("trả lời qua");
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
		const contact = screen.getByLabelText(/^Email hoặc Telegram/);
		await userEvent.clear(contact);
		await userEvent.type(contact, "không phải địa chỉ");
		await send();
		const message = screen.getByLabelText(/^Nội dung/);
		expect(message).toHaveAttribute("aria-invalid", "true");
		expect(message).toHaveFocus();
		expect(screen.getByText("Nhập nội dung.")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Nhập email hoặc username Telegram hợp lệ, hoặc để trống.",
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
			within(dialog).queryByRole("textbox", { name: /Không điền/ }),
		).toBeNull();
		expect(within(dialog).getAllByRole("textbox")).toHaveLength(3);
		expect(await seriousViolations(dialog)).toEqual([]);
	});
});
