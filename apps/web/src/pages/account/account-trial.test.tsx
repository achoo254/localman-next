import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trialUser } from "../../features/subscription/trial-test-helpers";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import {
	byId,
	renderAccount,
	setUpTrialTest,
	tearDownTrialTest,
} from "./account-trial-test-helpers";

const EXTENSION = "POST /api/v1/users/me/trial/extension";

const reasonBox = () => screen.getByRole("textbox", { name: /Reason/ });
const send = () =>
	userEvent.click(screen.getByRole("button", { name: "Send request" }));

const pendingUser = trialUser("active", {
	trial: {
		...trialUser("active").trial,
		extensionRequest: {
			status: "pending",
			requestedAt: "2026-10-10T03:00:00.000Z",
			decidedAt: null,
		},
	},
});

describe("AccountPage and the Pro trial", () => {
	beforeEach(setUpTrialTest);
	afterEach(tearDownTrialTest);

	it("counts down a running trial with its end date", async () => {
		const { container } = renderAccount(trialUser("active"));
		expect(
			await screen.findByRole("heading", {
				level: 2,
				name: "Pro trial · ends Oct 22, 2026",
			}),
		).toBeVisible();
		expect(byId("account-plan-trial-countdown")).toHaveTextContent(
			"12 days left",
		);
		await screen.findByRole("meter", { name: "Projects" });
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("offers the trial to a Free user who never started it", async () => {
		renderAccount(trialUser("available"));
		await userEvent.click(
			await screen.findByRole("button", { name: "Start 30-day trial" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Start your Pro trial" }),
		).toBeVisible();
		expect(byId("account-trial-extension")).toBeNull();
	});

	it("checks the reason before sending", async () => {
		const { calls } = renderAccount(trialUser("active"));
		await screen.findByRole("heading", { name: "Request an extension" });
		await send();
		expect(reasonBox()).toHaveAccessibleDescription(
			/Tell us briefly why you need more time\./,
		);
		await userEvent.click(reasonBox());
		await userEvent.paste("x".repeat(501));
		await send();
		expect(reasonBox()).toHaveAccessibleDescription(
			/Keep the reason to 500 characters or fewer\./,
		);
		expect(calls.some((call) => call.method === "POST")).toBe(false);
	});

	it("sends the request and shows it as pending", async () => {
		const { calls } = renderAccount(trialUser("active"), {
			[EXTENSION]: { status: 201, body: pendingUser },
		});
		await userEvent.type(
			await screen.findByRole("textbox", { name: /Reason/ }),
			"  Our QA cycle runs until November.  ",
		);
		await send();
		expect(await findToast("Extension requested.")).toBeVisible();
		expect(calls.find((call) => call.method === "POST")?.body).toEqual({
			reason: "Our QA cycle runs until November.",
		});
		expect(byId("account-trial-extension-status")).toHaveTextContent(
			"Request sent on Oct 10, 2026. You'll get a notification once it's decided.",
		);
		expect(screen.queryByRole("textbox", { name: /Reason/ })).toBeNull();
	});

	it.each([
		[
			409,
			"EXTENSION_PENDING",
			"You already have an extension request waiting for a reply.",
		],
		[
			409,
			"TRIAL_NOT_EXTENDABLE",
			"This trial can't be extended anymore: requests close a week after it ends.",
		],
		[
			429,
			"RATE_LIMITED",
			"You've sent too many extension requests today. Try again tomorrow.",
		],
		[
			400,
			"VALIDATION_ERROR",
			"The reason wasn't accepted. Check that it isn't empty or too long, then send it again.",
		],
	])("explains a %i %s refusal", async (status, code, text) => {
		renderAccount(trialUser("used"), {
			[EXTENSION]: {
				status,
				body: { error: { code, message: "Refused." } },
			},
		});
		await userEvent.type(
			await screen.findByRole("textbox", { name: /Reason/ }),
			"Need a few more days.",
		);
		await send();
		expect(
			await within(byId("account-trial-extension") ?? document.body).findByText(
				text,
			),
		).toBeVisible();
	});

	it.each([
		["approved", "Your last request was approved on Oct 9, 2026."],
		["declined", "Your last request was declined on Oct 9, 2026."],
	] as const)("shows a %s request and allows another", async (status, text) => {
		renderAccount(
			trialUser("used", {
				trial: {
					...trialUser("used").trial,
					extensionRequest: {
						status,
						requestedAt: "2026-10-08T03:00:00.000Z",
						decidedAt: "2026-10-09T03:00:00.000Z",
					},
				},
			}),
		);
		await waitFor(() =>
			expect(byId("account-trial-extension-status")).toHaveTextContent(text),
		);
		expect(screen.getByRole("textbox", { name: /Reason/ })).toBeVisible();
	});

	it("hides the form once the request window has closed", async () => {
		renderAccount(trialUser("usedLong"));
		await screen.findByRole("meter", { name: "Projects" });
		expect(byId("account-trial-extension")).toBeNull();
	});
});
