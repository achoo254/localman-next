import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import type { MockRoute } from "../../test/mock-fetch";
import { LIST, renderAdmin, request } from "./trial-extensions-test-helpers";

const refused = (status: number, code: string): MockRoute => ({
	status,
	body: { error: { code, message: "Refused." } },
});

describe("TrialExtensionsPage refusals", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("names a requester whose account was deleted by their sub", async () => {
		renderAdmin(true, {
			[`GET ${LIST}`]: {
				body: {
					items: [
						request("r9", {
							user: { sub: "sub-gone", username: null, name: null },
						}),
					],
					nextCursor: null,
				},
			},
		});
		expect(
			await screen.findByRole("heading", { name: "sub-gone" }),
		).toBeVisible();
		// The row's actions may render after its heading on a slow machine.
		await waitFor(() =>
			expect(
				screen.getByRole("button", {
					name: "Approve the request from sub-gone",
				}),
			).toBeVisible(),
		);
	});

	it.each([
		[
			"approve",
			"Approve",
			refused(409, "EXTENSION_DECIDED"),
			"This request was already approved or declined. The list now shows its current state.",
		],
		[
			"approve",
			"Approve",
			refused(409, "PLAN_HAS_NO_EXPIRY"),
			"This user has Pro without an end date, so there's no trial to extend.",
		],
		[
			"decline",
			"Decline",
			refused(409, "EXTENSION_DECIDED"),
			"This request was already approved or declined. The list now shows its current state.",
		],
		[
			"decline",
			"Decline",
			refused(404, "NOT_FOUND"),
			"This request no longer exists. The list now shows the current requests.",
		],
	])("explains a refused %s", async (decision, label, reply, text) => {
		const { calls } = renderAdmin(true, {
			[`POST ${LIST}/r1/${decision}`]: reply,
		});
		await userEvent.click(
			await screen.findByRole("button", {
				name: `${label} the request from Lan r1`,
			}),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(within(dialog).getByRole("button", { name: label }));
		expect(await within(dialog).findByText(text)).toBeVisible();
		if (!text.includes("without an end date")) {
			await waitFor(() =>
				expect(calls.filter((call) => call.path === LIST)).toHaveLength(2),
			);
		}
	});

	it.each([
		[
			refused(409, "PLAN_HAS_NO_EXPIRY"),
			"This user has Pro without an end date, so there's no trial to extend.",
		],
		[
			refused(404, "NOT_FOUND"),
			"No account has this sub. Check it and try again.",
		],
	])("explains a refused direct extension", async (reply, text) => {
		renderAdmin(true, {
			"POST /api/v1/admin/users/sub-7/extend-trial": reply,
		});
		const form = within(
			await screen.findByRole("region", { name: "Extend a user's trial" }),
		);
		await userEvent.type(
			form.getByRole("textbox", { name: /User sub/ }),
			"sub-7",
		);
		await userEvent.click(form.getByRole("button", { name: "Extend trial" }));
		expect(await form.findByText(text)).toBeVisible();
	});
});
