import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import { expectProInterestSource } from "../../test/pro-interest";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	LOOKUP,
	MEMBERS,
	apiError,
	listBody,
	member,
	openFromMenu,
	typeAndLook,
} from "./collaborators-test-helpers";

vi.mock("../../platform/clipboard", () => ({ copyText: vi.fn() }));

describe("member limit of the invite dialog", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.mocked(copyText).mockResolvedValue(true);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the full Free project and opens the plans modal for members", async () => {
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: listBody([member("an"), member("binh")]),
		});
		const full = await waitFor(() => {
			const node = dialog.querySelector('[data-id="modal-collaborators-full"]');
			if (!node) throw new Error("not full yet");
			return node;
		});
		expect(full).toHaveTextContent("Đã đủ 3 thành viên");
		expect(full).toHaveTextContent("Thành viên thứ 4 cần gói Pro.");
		expect(within(dialog).getByLabelText("Username hoặc email")).toBeDisabled();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xem gói" }),
		);
		const plans = await screen.findByRole("dialog", { name: "Quản lý gói" });
		expect(plans).toHaveTextContent("3 thành viên mỗi project");
		await userEvent.click(
			within(plans).getByRole("button", { name: "Liên hệ" }),
		);
		await expectProInterestSource("plan_limit_members");
	});

	it("reloads and opens the plans modal on PLAN_LIMIT_REACHED", async () => {
		const { calls, dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: listBody([member("an")]),
			[LOOKUP]: {
				body: {
					match: {
						username: "chi",
						name: "Chi",
						picture: null,
						maskedEmail: null,
						emailVerified: true,
					},
				},
			},
			[`POST ${MEMBERS}`]: apiError(403, "PLAN_LIMIT_REACHED", {
				limit: "members",
				max: 3,
				used: 3,
			}),
		});
		await within(dialog).findByText("An · @an");
		await typeAndLook(dialog, "chi");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xác nhận mời" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Quản lý gói" }),
		).toHaveTextContent("3 thành viên mỗi project");
		expect(
			calls.filter((c) => c.method === "GET" && c.path === MEMBERS),
		).toHaveLength(2);
	});
});
