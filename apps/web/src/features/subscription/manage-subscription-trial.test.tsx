import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import type { CurrentUser } from "../auth/current-user";
import {
	resetCurrentUserCache,
	setCurrentUser,
} from "../auth/use-current-user";
import {
	type LimitReason,
	ManageSubscriptionModal,
} from "./manage-subscription-modal";
import { freezeTrialClock, trialUser } from "./trial-test-helpers";

function renderModal(user: CurrentUser, reason: LimitReason = null) {
	setCurrentUser(user);
	const onContact = vi.fn();
	const onOpenChange = vi.fn();
	const view = renderRoutes(
		[
			{
				path: "*",
				element: (
					<ManageSubscriptionModal
						open
						onOpenChange={onOpenChange}
						plan={user.plan}
						reason={reason}
						onContact={onContact}
					/>
				),
			},
		],
		"/projects",
	);
	const dialog = within(screen.getByRole("dialog", { name: "Manage plan" }));
	return { ...view, dialog, onContact, onOpenChange };
}

describe("Manage plan and the Pro trial", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		freezeTrialClock();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("replaces Contact with the trial at a limit, keeping the form as a link", async () => {
		const { dialog, onContact, container } = renderModal(
			trialUser("available"),
			"projects",
		);
		expect(dialog.queryByRole("button", { name: "Contact" })).toBeNull();
		expect(
			dialog.getByRole("button", { name: "Start 30-day trial" }),
		).toBeVisible();
		await userEvent.click(
			dialog.getByRole("button", { name: "Tell us what you need from Pro" }),
		);
		expect(onContact).toHaveBeenCalledWith("plan_limit_projects");
		expect(await seriousViolations(container.ownerDocument.body)).toEqual([]);
	});

	it("closes the plans for the confirmation, which starts the trial", async () => {
		const { calls } = mockFetch({
			"POST /api/v1/users/me/trial": { body: trialUser("active") },
		});
		const { dialog, onOpenChange } = renderModal(trialUser("available"));
		await userEvent.click(
			dialog.getByRole("button", { name: "Start 30-day trial" }),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		const confirm = await screen.findByRole("dialog", {
			name: "Start your Pro trial",
		});
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Start trial" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Start your Pro trial" }),
			).toBeNull(),
		);
		expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
			"POST /api/v1/users/me/trial",
		]);
		// The cached session now says Pro: the Pro card is the current plan.
		expect(
			document.querySelector('[data-id="modal-subscription-pro-cta"]'),
		).toHaveTextContent("Trial ends in 12 days");
	});

	it("shows a running trial with a way to the account page", async () => {
		const { dialog, onOpenChange } = renderModal(trialUser("active"));
		expect(
			document.querySelector('[data-id="modal-subscription-pro-cta"]'),
		).toHaveTextContent("Trial ends in 12 days");
		await userEvent.click(
			dialog.getByRole("link", { name: "See it in your account" }),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("shows Trial used with the extension link after a trial", () => {
		const { dialog } = renderModal(trialUser("used"));
		expect(
			document.querySelector('[data-id="modal-subscription-pro-cta"]'),
		).toHaveTextContent("Trial used");
		expect(
			dialog.getByRole("link", { name: "Request an extension" }),
		).toHaveAttribute("href", "/account");
	});
});
