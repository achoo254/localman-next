import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	EXPIRES,
	LOOKUP,
	MEMBERS,
	member,
	memberStore,
	openFromMenu,
	person,
	typeAndLook,
} from "./collaborators-test-helpers";

vi.mock("../../platform/clipboard", () => ({ copyText: vi.fn() }));

const ORIGIN = window.location.origin;
const NO_MATCH = { body: { match: null } };
const pendingEmail = (id: string, email: string) =>
	member(id, {
		status: "pending",
		user: null,
		inviteeEmail: email,
		acceptedAt: null,
		expiresAt: EXPIRES,
	});

describe("inviting collaborators", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.mocked(copyText).mockResolvedValue(true);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("looks up only on Mời, shows the unverified account, then invites on confirm", async () => {
		const store = memberStore([]);
		const lan = person("lan", { emailVerified: false });
		const invited = member("lan", {
			status: "pending",
			acceptedAt: null,
			expiresAt: EXPIRES,
			user: lan,
		});
		const match = { ...lan, maskedEmail: "l***@ex***.com" };
		const { calls, dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: { body: { match } },
			[`POST ${MEMBERS}`]: () =>
				store.invite(invited, { invitee: match, notified: true }),
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await typeAndLook(dialog, "lan@example.com");
		const lookups = calls.filter((c) => c.path === `${MEMBERS}/lookup`);
		expect(lookups).toHaveLength(1);
		expect(lookups[0]?.body).toEqual({ usernameOrEmail: "lan@example.com" });
		const card = dialog.querySelector('[data-id="invite-match-lan"]');
		expect(card).toHaveTextContent("l***@ex***.com");
		expect(
			dialog.querySelector('[data-id="invite-match-unverified"]'),
		).toHaveTextContent("email chưa xác minh");
		expect(dialog).toHaveTextContent("chỉ mời nếu bạn nhận ra người này");
		expect(await seriousViolations(dialog)).toEqual([]);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xác nhận mời" }),
		);
		expect(await findToast("Đã mời Lan")).toHaveTextContent(
			"Họ thấy lời mời trong app",
		);
		expect(
			dialog.querySelector('[data-id="modal-collaborators-status"]'),
		).toHaveTextContent("Đã mời Lan");
		const link = within(dialog).getByLabelText("Link mời cho Lan");
		expect(link).toHaveValue(`${ORIGIN}/invite/toklan`);
		expect(dialog).toHaveTextContent("Link chỉ hiện lần này");
		expect(within(dialog).getByLabelText("Username hoặc email")).toHaveFocus();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Sao chép link" }),
		);
		expect(copyText).toHaveBeenCalledWith(`${ORIGIN}/invite/toklan`);
		expect(
			await within(dialog).findByText("Đã sao chép link"),
		).toBeInTheDocument();
		expect(
			dialog.querySelector('[data-id="collaborator-lan"]'),
		).toHaveTextContent("Đang chờ");
	});

	it("announces lookup errors and drops them when the input changes", async () => {
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: memberStore([]).get,
			[LOOKUP]: NO_MATCH,
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await typeAndLook(dialog, "ghost");
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"Không tìm thấy tài khoản với username hoặc email này.",
		);
		await userEvent.type(
			within(dialog).getByLabelText("Username hoặc email"),
			"x",
		);
		expect(within(dialog).queryByText(/Không tìm thấy/)).toBeNull();
	});

	it("creates a one-time link for an email without account and copies it", async () => {
		const store = memberStore([]);
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: NO_MATCH,
			[`POST ${MEMBERS}`]: () =>
				store.invite(pendingEmail("x1", "new@example.com")),
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await typeAndLook(dialog, "new@example.com");
		expect(
			dialog.querySelector('[data-id="modal-collaborators-no-match"]'),
		).toHaveTextContent("new@example.com");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo link mời" }),
		);
		await waitFor(() =>
			expect(copyText).toHaveBeenCalledWith(`${ORIGIN}/invite/tokx1`),
		);
		expect(
			dialog.querySelector('[data-id="collaborator-link-x1"]'),
		).toHaveTextContent("Link mời · new@example.com · hết hạn 16/10/2026");
	});

	it("points at the copy button, without an error, when the automatic copy is refused", async () => {
		vi.mocked(copyText).mockResolvedValue(false);
		const store = memberStore([]);
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: NO_MATCH,
			[`POST ${MEMBERS}`]: () => store.invite(pendingEmail("x2", "a@b.co")),
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await typeAndLook(dialog, "a@b.co");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo link mời" }),
		);
		const link = await within(dialog).findByLabelText("Link mời cho a@b.co");
		await waitFor(() =>
			expect(link).toHaveAccessibleDescription(
				/Bấm nút sao chép để copy link\./,
			),
		);
		expect(link).not.toHaveAttribute("aria-invalid");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Sao chép link" }),
		);
		expect(link).toHaveAccessibleDescription(/chọn link và sao chép thủ công/);
	});

	it("refuses an invite link that is not an /invite/ path", async () => {
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: memberStore([]).get,
			[LOOKUP]: NO_MATCH,
			[`POST ${MEMBERS}`]: {
				status: 201,
				body: {
					collaborator: pendingEmail("x3", "c@d.co"),
					inviteLink: "https://evil.example/invite/x",
					invitee: null,
					notified: false,
				},
			},
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await typeAndLook(dialog, "c@d.co");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo link mời" }),
		);
		expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
		expect(within(dialog).queryByLabelText(/^Link mời cho/)).toBeNull();
		expect(copyText).not.toHaveBeenCalled();
	});
});
