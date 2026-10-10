import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import type { MockReply } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import { LIST, renderAdmin } from "./pro-interest-test-helpers";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

/** A route whose answers wait until the test releases them. */
function held() {
	const pending: Array<(reply: MockReply) => void> = [];
	return {
		route: () =>
			new Promise<MockReply>((resolve) => {
				pending.push(resolve);
			}),
		release: (reply: MockReply) => {
			for (const resolve of pending.splice(0)) resolve(reply);
		},
	};
}

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const status = () => byId("admin-pro-row-a1-status");

describe("ProInterestPage loading states", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows stats and list skeletons on a slow first load", async () => {
		const list = held();
		renderAdmin(true, { "GET /api/v1/admin/pro-interest": list.route });
		await waitFor(() => expect(byId("admin-pro-loading")).not.toBeNull());
		expect(byId("admin-pro-loading")).toHaveAttribute("aria-busy", "true");
		expect(await seriousViolations(document.body)).toEqual([]);
		await act(async () => list.release(LIST));
		expect(await screen.findByText("a1***@example.com")).toBeVisible();
		expect(byId("admin-pro-loading")).toBeNull();
	});

	it("keeps the rows dimmed under a bar while a filter loads", async () => {
		let slow: ReturnType<typeof held> | null = null;
		renderAdmin(true, {
			"GET /api/v1/admin/pro-interest": () => (slow ? slow.route() : LIST),
		});
		await screen.findByText("a1***@example.com");
		const next = held();
		slow = next;
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Source" }),
			"pricing",
		);
		await waitFor(() => expect(byId("panel-progress")).not.toBeNull());
		expect(document.querySelector("[data-dimmed]")).not.toBeNull();
		expect(screen.getByText("a1***@example.com")).toBeVisible();
		await act(async () => next.release(LIST));
		await waitFor(() => expect(byId("panel-progress")).toBeNull());
	});

	it("marks contacted at once and undoes it with a toast when refused", async () => {
		const put = held();
		renderAdmin(true, {
			"PUT /api/v1/admin/pro-interest/a1/contacted": put.route,
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Mark as contacted" }),
		);
		expect(status()).toHaveTextContent("Contacted");
		await act(async () =>
			put.release({
				status: 500,
				body: { error: { code: "INTERNAL", message: "Could not save" } },
			}),
		);
		await waitFor(() => expect(status()).toHaveTextContent("Not contacted"));
		expect(await findToast("Could not save")).toBeInTheDocument();
	});

	it("spins Export CSV until the file is ready, keeping focus", async () => {
		const exported = held();
		renderAdmin(true, {
			"GET /api/v1/admin/pro-interest/export": exported.route,
		});
		const button = await screen.findByRole("button", { name: "Export CSV" });
		await userEvent.click(button);
		expect(button).toHaveAttribute("aria-busy", "true");
		expect(button).toHaveFocus();
		await act(async () =>
			exported.release({ body: { filename: "pro.csv", csv: "email\n" } }),
		);
		await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
	});
});
