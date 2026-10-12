import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { LIST_PATH, message, renderInbox } from "./feedback-inbox-test-helpers";

describe("FeedbackInboxPage deletes and paging", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("deletes a message after confirming, dry run first, then reloads", async () => {
		const { calls } = renderInbox(true, {
			"DELETE /api/v1/admin/contact-messages/m1": ({ query }) => ({
				body: {
					id: "m1",
					deleted: !query.has("dryRun"),
					dryRun: query.has("dryRun"),
				},
			}),
		});
		const [remove] = await screen.findAllByRole("button", { name: "Delete" });
		if (!remove) throw new Error("no delete button");
		await userEvent.click(remove);
		// The dialog opens once the dry run answers.
		const dialog = await screen.findByRole("dialog", {
			name: "Delete message",
		});
		expect(dialog).toHaveTextContent("Delete the message from Lan?");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete permanently" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		const deletes = calls.filter((c) => c.method === "DELETE");
		expect(deletes.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		await waitFor(() =>
			expect(calls.filter((c) => c.path === LIST_PATH)).toHaveLength(2),
		);
	});

	it("moves back to the last page with messages when the current one is empty", async () => {
		const { calls } = renderInbox(true, {
			[`GET ${LIST_PATH}`]: ({ query }) =>
				query.get("page") === "2"
					? // Held a moment so the refresh state is visible.
						new Promise((resolve) =>
							setTimeout(
								() =>
									resolve({
										body: { items: [], total: 20, page: 2, pageSize: 20 },
									}),
								30,
							),
						)
					: {
							body: {
								items: [message("m1")],
								total: 21,
								page: 1,
								pageSize: 20,
							},
						},
		});
		await screen.findByRole("heading", { name: "Bug report · Lan" });
		await userEvent.click(screen.getByRole("button", { name: "Next page" }));
		// The shown messages stay while the next page loads.
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="admin-feedback-list"]'),
			).toHaveAttribute("aria-busy", "true"),
		);
		expect(
			screen.getByRole("heading", { name: "Bug report · Lan" }),
		).toBeInTheDocument();
		await waitFor(() => {
			const pages = calls
				.filter((c) => c.path === LIST_PATH)
				.map((c) => c.query.get("page"));
			expect(pages).toEqual(["1", "2", "1"]);
		});
		expect(
			await screen.findByRole("heading", { name: "Bug report · Lan" }),
		).toBeInTheDocument();
	});
});
