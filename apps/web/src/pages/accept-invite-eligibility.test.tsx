import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../features/auth/use-current-user";
import {
	ACCEPT,
	PREVIEW,
	preview,
	renderInvite,
	tokenError,
} from "./accept-invite-test-helpers";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("/invite/:token eligibility", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("explains an invite meant for another account and offers to switch", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "NOT_INVITEE" }),
		});
		await screen.findByText("Tài khoản này không nhận được lời mời");
		expect(byId("invite-page-ineligible")).toHaveTextContent(
			"Lời mời gửi cho t***@example.com.",
		);
		expect(screen.queryByRole("button", { name: "Tham gia" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Đăng nhập tài khoản khác" }),
		).toBeInTheDocument();
	});

	it("explains an unverified email", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "EMAIL_NOT_VERIFIED" }),
		});
		expect(
			await screen.findByText(/Email của tài khoản này chưa được xác minh/),
		).toBeInTheDocument();
	});

	it("tells members they already belong to the project", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "ALREADY_MEMBER" }),
		});
		expect(
			await screen.findByText("Bạn đã là thành viên của Demo shop."),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Mở project" })).toHaveAttribute(
			"href",
			"/projects/p1",
		);
		expect(screen.queryByRole("button", { name: "Tham gia" })).toBeNull();
	});

	it("says a full project cannot take more members, without an upgrade", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "MEMBER_LIMIT" }),
		});
		expect(
			await screen.findByText(
				/Project đã đủ thành viên theo gói của chủ project/,
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Tham gia" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Xem gói" })).toBeNull();
	});

	it("tells a member the owner removed that the link no longer admits them", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "REMOVED_BY_OWNER" }),
		});
		expect(
			await screen.findByText(
				"Chủ project đã gỡ bạn khỏi project này. Liên hệ chủ project nếu cần tham gia lại.",
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Tham gia" })).toBeNull();
	});

	it.each([
		[403, "REMOVED_BY_OWNER", "invite-page-removed"],
		[403, "EMAIL_NOT_VERIFIED", "invite-page-ineligible"],
		[403, "PLAN_LIMIT_REACHED", "invite-page-full"],
		[410, "INVITE_USED", "invite-page-invalid"],
	])("maps a refused accept (%s %s) to its state", async (status, code, id) => {
		renderInvite({ [PREVIEW]: preview(), [ACCEPT]: tokenError(status, code) });
		await userEvent.click(
			await screen.findByRole("button", { name: "Tham gia" }),
		);
		await screen.findByRole("heading", { level: 1 });
		await vi.waitFor(() => expect(byId(id)).not.toBeNull());
	});

	it("keeps Tham gia for other accept errors", async () => {
		renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: tokenError(429, "RATE_LIMITED"),
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Tham gia" }),
		);
		expect(
			await screen.findByText(
				"Bạn đã mở quá nhiều link mời. Hãy thử lại sau ít phút.",
			),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tham gia" })).toBeEnabled();
	});

	it("retries a preview that failed", async () => {
		let fail = true;
		renderInvite({
			[PREVIEW]: () => (fail ? tokenError(500, "INTERNAL") : preview()),
		});
		await screen.findByRole("heading", { name: "Không mở được lời mời" });
		// API messages are English: the page shows its own Vietnamese text.
		expect(byId("invite-page-error")).toHaveTextContent(
			"Không mở được lời mời. Hãy thử lại sau.",
		);
		expect(byId("invite-page-error")).not.toHaveTextContent("INTERNAL");
		fail = false;
		await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(
			await screen.findByRole("heading", { name: "Tham gia Demo shop" }),
		).toBeInTheDocument();
	});

	it("treats a malformed token as an invalid link, without a retry", async () => {
		renderInvite({ [PREVIEW]: tokenError(400, "VALIDATION_ERROR") });
		expect(
			await screen.findByRole("heading", {
				name: "Link mời không còn hiệu lực",
			}),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
	});

	it("explains a CONFLICT on accept in Vietnamese", async () => {
		renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: tokenError(409, "CONFLICT"),
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Tham gia" }),
		);
		expect(
			await screen.findByText("Lời mời vừa thay đổi. Hãy thử lại."),
		).toBeInTheDocument();
	});
});
