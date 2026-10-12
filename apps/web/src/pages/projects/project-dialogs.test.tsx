import { limitsFor } from "@localman/shared/constants";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { findToast } from "../../test/toast";
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
							{ kind: "requestLogs", count: 120 },
							{ kind: "webhookInboxes", count: 2 },
							{ kind: "callbacks", count: 1 },
						],
					},
				};
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
		const dialog = screen.getByRole("dialog", { name: "Delete project" });
		expect(
			await within(dialog).findByText(
				"This also deletes 3 resources, 1 collaborator, 120 request log entries, 2 webhook inboxes, 1 callback.",
			),
		).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete project" }),
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
		await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
		await screen.findByText("Project p1 (copy)");
		const names = screen
			.getAllByRole("listitem")
			.map((item) => item.textContent ?? "");
		expect(names[1]).toContain("Project p1 (copy)");
	});

	it("names the project limit when the server reports PLAN_LIMIT_REACHED", async () => {
		renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"POST /api/v1/projects/p1/clone": PLAN_LIMIT,
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
		const notice = await findToast(
			`You've reached the limit of ${limitsFor("free").projects} projects on this account.`,
		);
		expect(notice).toHaveTextContent("Tell us with the feedback form.");
		expect(notice).not.toHaveTextContent(/plan|Pro/);
	});

	it("skips the form when the plan is already full", async () => {
		const full = Array.from({ length: limitsFor("free").projects }, (_, i) =>
			makeProject(`p${i}`),
		);
		renderPage({ "GET /api/v1/projects": { body: { items: full } } });
		await userEvent.click(
			await screen.findByRole("button", { name: "Create a new project" }),
		);
		expect(await findToast("You've reached the limit of")).toBeInTheDocument();
		expect(screen.queryByRole("dialog", { name: "New project" })).toBeNull();
	});

	it("opens the delete dialog on Cancel and skips the summary when nothing else goes", async () => {
		renderPage({
			"GET /api/v1/projects": { body: { items: [makeProject("p1")] } },
			"DELETE /api/v1/projects/p1": {
				body: { id: "p1", deleted: false, dryRun: true, dependents: [] },
			},
		});
		await openMenu("Project p1");
		await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
		const dialog = screen.getByRole("dialog", { name: "Delete project" });
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Cancel" }),
			).toHaveFocus(),
		);
		await waitFor(() =>
			expect(
				dialog.querySelector('[data-id="modal-delete-project-summary"]'),
			).toBeNull(),
		);
		expect(dialog).toHaveTextContent("can't be undone.");
	});
});
