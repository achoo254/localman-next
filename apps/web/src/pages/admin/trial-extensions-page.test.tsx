import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import { LIST, renderAdmin, request } from "./trial-extensions-test-helpers";

const lastList = (calls: ReturnType<typeof renderAdmin>["calls"]) =>
	calls.filter((call) => call.path === LIST).at(-1);

describe("TrialExtensionsPage", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("blocks users who are not the owner without calling the admin API", async () => {
		const { calls } = renderAdmin(false);
		expect(
			await screen.findByRole("heading", {
				name: "403 · Only the owner can see this page",
			}),
		).toBeInTheDocument();
		expect(calls.some((call) => call.path.startsWith("/api/v1/admin"))).toBe(
			false,
		);
	});

	it("falls back to the 403 page when the API refuses", async () => {
		renderAdmin(true, {
			[`GET ${LIST}`]: {
				status: 403,
				body: { error: { code: "FORBIDDEN", message: "Forbidden." } },
			},
		});
		expect(
			await screen.findByText("403 · Only the owner can see this page"),
		).toBeInTheDocument();
	});

	it("shows list skeletons, busy, on a slow first load", async () => {
		renderAdmin(true, {
			[`GET ${LIST}`]: () => new Promise<never>(() => undefined),
		});
		await waitFor(
			() =>
				expect(
					document.querySelector('[data-id="admin-trial-loading"]'),
				).toHaveAttribute("aria-busy", "true"),
			{ timeout: 3000 },
		);
		// The status text is filled in after mount (a live region announces it).
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading requests…"),
		);
	});

	it("lists pending requests with their reason, filters and pages by cursor", async () => {
		const { calls, container } = renderAdmin(true);
		expect(
			await screen.findByRole("heading", { name: "Lan r1" }),
		).toBeVisible();
		expect(
			document.querySelector('[data-id="admin-trial-item-r1-reason"]'),
		).toHaveTextContent("QA cycle runs until November");
		expect(
			document.querySelector('[data-id="admin-trial-item-r1"]'),
		).toHaveTextContent("trial ends Oct 22, 2026");
		expect(lastList(calls)?.query.get("status")).toBe("pending");
		expect(
			screen.getByRole("link", { name: "Trial extensions" }),
		).toHaveAttribute("aria-current", "page");
		expect(await seriousViolations(container)).toEqual([]);

		await userEvent.click(screen.getByRole("button", { name: "Next page" }));
		expect(
			await screen.findByRole("heading", { name: "Lan r3" }),
		).toBeVisible();
		expect(lastList(calls)?.query.get("cursor")).toBe("c2");
		await userEvent.click(
			screen.getByRole("button", { name: "Previous page" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Lan r1" }),
		).toBeVisible();
		expect(lastList(calls)?.query.get("cursor")).toBeNull();

		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Status" }),
			"all",
		);
		await waitFor(() =>
			expect(lastList(calls)?.query.get("status")).toBe("all"),
		);
	});

	it.each([
		["approve", "Approve", "Approved the extension for Lan r1."],
		["decline", "Decline", "Declined the request from Lan r1."],
	])("can %s a request after confirming", async (decision, label, toast) => {
		const { calls } = renderAdmin(true, {
			[`POST ${LIST}/r1/${decision}`]: { body: request("r1") },
		});
		await userEvent.click(
			await screen.findByRole("button", {
				name: `${label} the request from Lan r1`,
			}),
		);
		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveTextContent("QA cycle runs until November");
		await userEvent.click(within(dialog).getByRole("button", { name: label }));
		expect(await findToast(toast)).toBeVisible();
		expect(
			calls.filter((call) => call.method === "POST").map((call) => call.path),
		).toEqual([`${LIST}/r1/${decision}`]);
		await waitFor(() =>
			expect(calls.filter((call) => call.path === LIST)).toHaveLength(2),
		);
	});

	it("extends a user's trial directly after checking the fields", async () => {
		const { calls } = renderAdmin(true, {
			"POST /api/v1/admin/users/sub-42/extend-trial": {
				body: {
					sub: "sub-42",
					plan: "pro",
					planExpiresAt: "2026-11-05T16:59:59.999Z",
				},
			},
		});
		const form = within(
			await screen.findByRole("region", { name: "Extend a user's trial" }),
		);
		const days = form.getByRole("spinbutton", { name: /Days/ });
		await userEvent.clear(days);
		await userEvent.type(days, "91");
		await userEvent.click(form.getByRole("button", { name: "Extend trial" }));
		expect(form.getByText("Enter the user's sub.")).toBeVisible();
		expect(
			form.getByText("Enter a whole number of days from 1 to 90."),
		).toBeVisible();

		await userEvent.type(
			form.getByRole("textbox", { name: /User sub/ }),
			"sub-42",
		);
		await userEvent.clear(days);
		await userEvent.type(days, "14");
		await userEvent.click(form.getByRole("button", { name: "Extend trial" }));
		expect(
			await findToast(
				"Extended the trial of sub-42 by 14 days, until Nov 5, 2026.",
			),
		).toBeVisible();
		expect(calls.find((call) => call.method === "POST")?.body).toEqual({
			days: 14,
		});
	});
});
