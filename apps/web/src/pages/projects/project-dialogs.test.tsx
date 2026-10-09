import { limitsFor } from "@localman/shared/constants";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { expectProInterestSource } from "../../test/pro-interest";
import { PLAN_LIMIT, openMenu, renderPage } from "./projects-test-helpers";

describe("project dialogs", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("previews the delete with a dry run, then deletes", async () => {
		const { calls } = renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"DELETE /api/v1/projects/p1": ({ query }) => {
				const dryRun = query.get("dryRun") === "true";
				return {
					body: {
						id: "p1",
						deleted: !dryRun,
						dryRun,
						dependents: [
							{ kind: "resources", count: 3 },
							{ kind: "collaborators", count: 1 },
						],
					},
				};
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
		const dialog = screen.getByRole("dialog", { name: "Xoá project" });
		expect(
			await within(dialog).findByText(
				"Sẽ xoá kèm 3 resource, 1 cộng tác viên.",
			),
		).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xoá project" }),
		);
		await waitFor(() => expect(screen.queryByText("Project p1")).toBeNull());
		const deletes = calls.filter((c) => c.method === "DELETE");
		expect(deletes.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});

	it("inserts the clone after its source", async () => {
		renderPage({
			"GET /api/v1/projects": {
				body: { items: [makeProject("p1"), makeProject("p2")] },
			},
			"POST /api/v1/projects/p1/clone": {
				status: 201,
				body: makeProject("p3", { name: "Project p1 (copy)" }),
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Nhân bản" }));
		await screen.findByText("Project p1 (copy)");
		const names = screen
			.getAllByRole("listitem")
			.map((item) => item.textContent ?? "");
		expect(names[1]).toContain("Project p1 (copy)");
	});

	it("opens the plans modal when the server reports PLAN_LIMIT_REACHED", async () => {
		renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"POST /api/v1/projects/p1/clone": PLAN_LIMIT,
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Nhân bản" }));
		const dialog = await screen.findByRole("dialog", { name: "Quản lý gói" });
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			`Bạn đã đạt giới hạn gói Free: ${limitsFor("free").projects} project`,
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Liên hệ nâng cấp" }),
		);
		await expectProInterestSource("plan_limit_projects");
	});

	it("skips the form when the plan is already full", async () => {
		const full = Array.from({ length: limitsFor("free").projects }, (_, i) =>
			makeProject(`p${i}`),
		);
		renderPage({ "GET /api/v1/projects": { body: { items: full } } });
		await userEvent.click(
			await screen.findByRole("button", { name: "Tạo project mới" }),
		);
		expect(
			await screen.findByRole("dialog", { name: "Quản lý gói" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("dialog", { name: "Project mới" })).toBeNull();
	});

	it("opens the delete dialog on Huỷ and skips the summary when nothing else goes", async () => {
		renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"DELETE /api/v1/projects/p1": {
				body: { id: "p1", deleted: false, dryRun: true, dependents: [] },
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
		const dialog = screen.getByRole("dialog", { name: "Xoá project" });
		await waitFor(() =>
			expect(within(dialog).getByRole("button", { name: "Huỷ" })).toHaveFocus(),
		);
		await waitFor(() =>
			expect(
				dialog.querySelector('[data-id="modal-delete-project-summary"]'),
			).toBeNull(),
		);
		expect(dialog).toHaveTextContent("không thể hoàn tác.");
	});

	it("focuses the plans dialog itself", async () => {
		renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"POST /api/v1/projects/p1/clone": PLAN_LIMIT,
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Nhân bản" }));
		const dialog = await screen.findByRole("dialog", { name: "Quản lý gói" });
		await waitFor(() => expect(dialog).toHaveFocus());
		expect(dialog).toHaveTextContent(
			"Không giới hạn request tới mock mỗi tháng",
		);
	});
});
