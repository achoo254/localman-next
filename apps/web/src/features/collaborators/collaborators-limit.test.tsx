import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
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

	it("shows the full project and how to free a seat, without plans", async () => {
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: listBody([member("an"), member("binh")]),
		});
		const full = await waitFor(() => {
			const node = dialog.querySelector('[data-id="modal-collaborators-full"]');
			if (!node) throw new Error("not full yet");
			return node;
		});
		expect(full).toHaveTextContent("Limit of 3 members reached");
		expect(full).toHaveTextContent(
			"Remove a member or an invitation to invite more people.",
		);
		expect(full).not.toHaveTextContent(/plan|Pro/);
		expect(within(dialog).getByLabelText("Username or email")).toBeDisabled();
		expect(within(dialog).queryByRole("button", { name: /plans/i })).toBeNull();
	});

	it("reloads and says the project is full on PLAN_LIMIT_REACHED", async () => {
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
			await within(dialog).findByText(
				"There's no free seat in this project. Remove a member or cancel an invitation first.",
			),
		).toBeVisible();
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(
			calls.filter((c) => c.method === "GET" && c.path === MEMBERS),
		).toHaveLength(2);
	});
});
