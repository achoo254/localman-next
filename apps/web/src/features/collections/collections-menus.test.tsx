import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LIST_PATH,
	ORDERS,
	byId,
	findRow,
	openMenu,
	renderWorkbenchPage,
	row,
	summary,
} from "./collections-test-utils";
import { realDeletes, trashRoute } from "./trash-test-routes";

afterEach(() => vi.unstubAllGlobals());

describe("collections tree menus", () => {
	it("moves a collection with requests to the Trash once delete is typed", async () => {
		const user = userEvent.setup();
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Orders", requestCount: 2 })] },
			},
			"DELETE /api/v1/collections/c1": trashRoute(2),
		});
		await openMenu("c1");
		await user.click(screen.getByRole("menuitem", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", {
			name: "Delete collection",
		});
		expect(confirm).toBeDisabled();
		await user.type(within(dialog).getByRole("textbox"), "delete");
		await user.click(confirm);
		expect(await screen.findByText("Moved Orders to the Trash.")).toBeVisible();
		expect(realDeletes(calls).at(0)?.body).toEqual({ confirm: "delete" });
		expect(row("c1")).toBeNull();
	});

	it("deletes an empty collection with one confirmation", async () => {
		const user = userEvent.setup();
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			"DELETE /api/v1/collections/c1": trashRoute(0),
		});
		await openMenu("c1");
		await user.click(screen.getByRole("menuitem", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).queryByRole("textbox")).toBeNull();
		await user.click(
			within(dialog).getByRole("button", { name: "Delete collection" }),
		);
		await waitFor(() => expect(realDeletes(calls)).toHaveLength(1));
		expect(realDeletes(calls).at(0)?.body).toEqual({});
	});

	it("asks for the word when the server counts requests the list missed", async () => {
		const user = userEvent.setup();
		renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			"DELETE /api/v1/collections/c1": trashRoute(3),
		});
		await openMenu("c1");
		await user.click(screen.getByRole("menuitem", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		expect(await within(dialog).findByRole("textbox")).toBeVisible();
		expect(dialog).toHaveTextContent("and its 3 requests");
		expect(
			within(dialog).getByRole("button", { name: "Delete collection" }),
		).toBeDisabled();
	});

	it("shows a Viewer only Share, Copy link and Export", async () => {
		renderWorkbenchPage(
			{
				[`GET ${LIST_PATH}`]: {
					body: { items: [summary("c1", { role: "viewer" })] },
				},
			},
			{ role: "viewer" },
		);
		const menu = await openMenu("c1");
		const items = within(menu)
			.getAllByRole("menuitem")
			.map((i) => i.textContent);
		expect(items).toEqual(["Share", "Copy link", "Export"]);
		expect(byId("sidebar-collections-new")).toBeDisabled();
		expect(byId("sidebar-collections-import")).toBeDisabled();
	});

	it("lets a workspace Viewer edit a collection shared with them as Editor", async () => {
		renderWorkbenchPage(
			{
				[`GET ${LIST_PATH}`]: {
					body: { items: [summary("c1", { role: "editor" })] },
				},
			},
			{ role: "viewer" },
		);
		const menu = await openMenu("c1");
		const items = within(menu)
			.getAllByRole("menuitem")
			.map((i) => i.textContent);
		// Moving, deleting and duplicating need a workspace role too.
		expect(items).toEqual([
			"Add request",
			"Add folder",
			"Rename",
			"Share",
			"Copy link",
			"Export",
		]);
	});

	it("gives an Editor every action of each kind", async () => {
		const user = userEvent.setup();
		renderWorkbenchPage(
			{
				[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
				"GET /api/v1/collections/c1": { body: ORDERS },
			},
			{ role: "editor" },
		);
		const labels = async (id: string) => {
			const menu = await openMenu(id);
			const names = within(menu)
				.getAllByRole("menuitem")
				.map((i) => i.textContent);
			await user.keyboard("{Escape}");
			return names;
		};
		expect(await labels("c1")).toEqual([
			"Add request",
			"Add folder",
			"Rename",
			"Duplicate",
			"Share",
			"Copy link",
			"Move",
			"Export",
			"Delete",
		]);
		await user.click(await findRow("c1"));
		expect(await labels("f1")).toEqual([
			"Add request",
			"Add folder",
			"Rename",
			"Duplicate",
			"Delete",
		]);
		expect(await labels("r2")).toEqual([
			"Add example",
			"Rename",
			"Duplicate",
			"Delete",
		]);
	});
});

describe("duplicating folders and requests", () => {
	it("copies a folder on the server in one call and shows the copy", async () => {
		const user = userEvent.setup();
		const copy = {
			...ORDERS.nodes[0],
			id: "f9",
			order: "a0V",
			name: "Users Copy",
		};
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			"GET /api/v1/collections/c1": { body: ORDERS },
			"POST /api/v1/collections/c1/nodes/f1/duplicate": {
				status: 201,
				body: { nodes: [copy] },
			},
		});
		await user.click(await findRow("c1"));
		await openMenu("f1");
		await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
		expect(await screen.findByText("Duplicated Users Copy.")).toBeVisible();
		expect(await findRow("f9")).toHaveTextContent("Users Copy");
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts.map((c) => c.path)).toEqual([
			"/api/v1/collections/c1/nodes/f1/duplicate",
		]);
	});
});
