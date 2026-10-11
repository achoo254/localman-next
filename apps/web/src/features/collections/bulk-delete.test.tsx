import { focusManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockRoute } from "../../test/mock-fetch";
import {
	LIST_PATH,
	ORDERS,
	byId,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const BULK_NODES = "/api/v1/collections/c1/nodes/bulk-delete";
const BULK_TRASH = "/api/v1/workspaces/w-team/collections/bulk-trash";
const deletion = {
	dryRun: false,
	deleted: true,
	folders: 0,
	requests: 2,
	examples: 0,
};

function renderShop(
	routes: Record<string, MockRoute> = {},
	role: "editor" | "viewer" = "editor",
) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: {
				body: {
					items: [
						summary("c1", { name: "Orders", requestCount: 2, role }),
						summary("c2", { name: "Misc", role }),
					],
				},
			},
			"GET /api/v1/collections/c1": { body: { ...ORDERS, role } },
			...routes,
		},
		{ role: role === "viewer" ? "viewer" : "admin" },
	);
}

const real = (calls: FetchCall[], path: string) =>
	calls.filter((c) => c.path === path && !c.query.has("dryRun"));

describe("bulk delete", () => {
	it("deletes picked requests of one collection in one call", async () => {
		const { calls } = renderShop({
			[`POST ${BULK_NODES}`]: ({ query }) => ({
				body: {
					...deletion,
					dryRun: query.has("dryRun"),
					irreversible: query.has("dryRun"),
				},
			}),
		});
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.click(await findRow("f1"));
		await user.keyboard("{Control>}");
		await user.click(await findRow("r1"));
		await user.click(await findRow("r2"));
		await user.keyboard("{/Control}");
		const bar = byId("sidebar-bulk-bar") as HTMLElement;
		expect(bar).toHaveTextContent("2 selected");
		await user.click(within(bar).getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Delete the selected items",
		});
		expect(await within(dialog).findByText(/too large to keep/)).toBeVisible();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Deleted 2 items.")).toBeVisible();
		expect(real(calls, BULK_NODES).map((c) => c.body)).toEqual([
			{ nodeIds: ["r1", "r2"] },
		]);
		expect(byId("sidebar-bulk-bar")).toBeNull();
	});

	it("asks for the word before trashing collections that hold requests", async () => {
		const { calls } = renderShop({
			[`POST ${BULK_TRASH}`]: ({ query }) => ({
				body: {
					dryRun: query.has("dryRun"),
					deleted: !query.has("dryRun"),
					collections: [
						{
							collectionId: "c1",
							name: "Orders",
							folders: 0,
							requests: 2,
							purgeAt: "x",
						},
					],
				},
			}),
		});
		const user = userEvent.setup();
		await findRow("c2");
		await user.keyboard("{Control>}");
		await user.click(await findRow("c1"));
		await user.keyboard("{/Control}{Shift>}");
		await user.click(await findRow("c2"));
		await user.keyboard("{/Shift}");
		await user.click(screen.getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", { name: "Delete" });
		await waitFor(() =>
			expect(within(dialog).getByRole("textbox")).toBeVisible(),
		);
		expect(confirm).toBeDisabled();
		await user.type(within(dialog).getByRole("textbox"), "delete");
		await user.click(confirm);
		await waitFor(() => expect(real(calls, BULK_TRASH)).toHaveLength(1));
		expect(real(calls, BULK_TRASH)[0]?.body).toEqual({
			// Tree order: "Misc" sorts before "Orders".
			collectionIds: ["c2", "c1"],
			confirm: "delete",
		});
	});

	it("clears with Escape and lets a Viewer only open rows", async () => {
		renderShop({}, "viewer");
		const user = userEvent.setup();
		await user.keyboard("{Control>}");
		await user.click(await findRow("c1"));
		await user.keyboard("{/Control}");
		expect(byId("sidebar-bulk-bar")).toBeNull();
		expect(await screen.findByRole("tab", { name: /Orders/ })).toBeVisible();
	});

	it("stops at a failing call and reports what was deleted", async () => {
		renderShop({
			[`POST ${BULK_NODES}`]: ({ query }) =>
				query.has("dryRun")
					? { body: { ...deletion, dryRun: true } }
					: {
							status: 404,
							body: { error: { code: "NODE_NOT_FOUND", message: "x" } },
						},
		});
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.keyboard("{Control>}");
		await user.click(await findRow("f1"));
		await user.keyboard("{/Control}");
		await user.keyboard("{Escape}");
		await user.keyboard("{Control>}");
		await user.click(await findRow("f1"));
		await user.keyboard("{/Control}");
		await user.click(screen.getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Delete" }),
			).toBeEnabled(),
		);
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(
			await within(dialog).findByText(/Deleted 0 of 1 items/),
		).toBeVisible();
	});

	it("asks the dry run once, not again when the window regains focus", async () => {
		const { calls } = renderShop({
			[`POST ${BULK_NODES}`]: { body: { ...deletion, dryRun: true } },
		});
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		await user.keyboard("{Control>}");
		await user.click(await findRow("r2"));
		await user.keyboard("{/Control}");
		await user.click(screen.getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Delete" }),
			).toBeEnabled(),
		);
		const dryRuns = () => calls.filter((c) => c.query.has("dryRun")).length;
		expect(dryRuns()).toBe(1);
		act(() => focusManager.setFocused(false));
		act(() => focusManager.setFocused(true));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(dryRuns()).toBe(1);
		act(() => focusManager.setFocused(undefined));
	});
});
