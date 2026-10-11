import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOG, openChangelog, renderShop } from "./changelog-test-utils";
import { detail } from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("changelog restore", () => {
	it("warns before an irreversible restore and says when it is unavailable", async () => {
		renderShop({
			[`POST ${LOG}/rv1/restore`]: ({ query }) =>
				query.get("dryRun") === "true"
					? { body: { dryRun: true, irreversible: true } }
					: {
							status: 409,
							body: { error: { code: "REVISION_UNAVAILABLE", message: "x" } },
						},
		});
		const user = await openChangelog();
		await user.click(screen.getByRole("button", { name: "Restore" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Restore to this change",
		});
		expect(
			await within(dialog).findByText(/too large to keep in the changelog/),
		).toBeVisible();
		await user.click(within(dialog).getByRole("button", { name: "Restore" }));
		expect(
			await within(dialog).findByText(/can no longer be restored/),
		).toBeVisible();
	});

	it("restores the collection and refreshes it", async () => {
		const restored = detail("c1", [], { name: "Shop (restored)" });
		const { calls } = renderShop({
			[`POST ${LOG}/rv1/restore`]: ({ query }) =>
				query.get("dryRun") === "true"
					? {
							body: {
								...{ dryRun: true, restored: false, irreversible: false },
								collection: null,
							},
						}
					: {
							body: {
								...{ dryRun: false, restored: true, irreversible: false },
								collection: restored,
							},
						},
		});
		const user = await openChangelog();
		await user.click(screen.getByRole("button", { name: "Restore" }));
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Restore" }),
			).toBeEnabled(),
		);
		await user.click(within(dialog).getByRole("button", { name: "Restore" }));
		expect(await screen.findByText("Restored the collection.")).toBeVisible();
		expect(calls.filter((c) => c.path === `${LOG}/rv1/restore`)).toHaveLength(
			2,
		);
		expect(
			await screen.findByRole("textbox", { name: "Collection name" }),
		).toHaveValue("Shop (restored)");
	});

	it("drops unsaved edits of the open page so they do not undo the restore", async () => {
		const restored = detail("c1", [], { name: "Shop (restored)" });
		const { calls } = renderShop({
			// A save in flight stays unanswered: the edit is never stored.
			"PATCH /api/v1/collections/c1": () => new Promise(() => {}),
			[`POST ${LOG}/rv1/restore`]: ({ query }) => ({
				body: {
					...{ dryRun: query.has("dryRun"), restored: !query.has("dryRun") },
					irreversible: false,
					collection: query.has("dryRun") ? null : restored,
				},
			}),
		});
		const user = await openChangelog();
		const name = screen.getByRole("textbox", { name: "Collection name" });
		await user.type(name, " draft");
		await user.click(screen.getByRole("button", { name: "Restore" }));
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", { name: "Restore" });
		await waitFor(() => expect(confirm).toBeEnabled());
		await user.click(confirm);
		expect(await screen.findByText(/were discarded/)).toBeVisible();
		await waitFor(() => expect(name).toHaveValue("Shop (restored)"));
		await new Promise((resolve) => setTimeout(resolve, 900));
		const restoreAt = calls.findIndex(
			(c) => c.path === `${LOG}/rv1/restore` && !c.query.has("dryRun"),
		);
		expect(calls.slice(restoreAt).some((c) => c.method === "PATCH")).toBe(
			false,
		);
	});

	it("lists what a restore change touched", async () => {
		renderShop({
			[`GET ${LOG}/rv1/diff`]: {
				body: {
					revisionId: "rv1",
					hidden: false,
					available: true,
					before: { name: "Shop" },
					after: { name: "Shop" },
					affected: [
						{ nodeId: "f1", name: "Users", change: "added" },
						{ nodeId: "r9", name: null, change: "removed" },
					],
				},
			},
		});
		const user = await openChangelog();
		await user.click(screen.getByRole("button", { name: "View diff" }));
		const list = await screen.findByRole("region", {
			name: "Items this restore changed",
		});
		expect(list).toHaveTextContent("Added Users");
		expect(list).toHaveTextContent("Removed an item");
	});
});
