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
		expect(full).toHaveTextContent("Limit of 3 members reached");
		expect(full).toHaveTextContent("Member #4 requires the Pro plan.");
		expect(within(dialog).getByLabelText("Username or email")).toBeDisabled();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "See plans" }),
		);
		const plans = await screen.findByRole("dialog", { name: "Manage plan" });
		expect(plans).toHaveTextContent("3 members per project");
		await userEvent.click(
			within(plans).getByRole("button", { name: "Contact" }),
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
			within(dialog).getByRole("button", { name: "Confirm invite" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Manage plan" }),
		).toHaveTextContent("3 members per project");
		expect(
			calls.filter((c) => c.method === "GET" && c.path === MEMBERS),
		).toHaveLength(2);
	});
});
