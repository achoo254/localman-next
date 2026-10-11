import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FLAGS_OFF,
	LIST_PATH,
	ORDERS,
	byId,
	detail,
	findRow,
	openMenu,
	renderWorkbenchPage,
	request,
	row,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("collections sidebar", () => {
	it("comes first in the rail, with a Trash link, and lists the workspace", async () => {
		renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { name: "Orders" })] },
			},
		});
		const rail = await screen.findByRole("button", { name: "Collections" });
		expect(rail).toHaveAttribute("aria-expanded", "true");
		expect(byId("sidebar")).toHaveAttribute("data-section", "collections");
		expect(await findRow("c1")).toHaveTextContent("Orders");
		expect(byId("sidebar-rail-trash")).toHaveAttribute("href", "/trash");
	});

	it("creates a blank collection and opens its name for editing", async () => {
		const user = userEvent.setup();
		const created = detail("c9", [], { name: "New collection" });
		let items: ReturnType<typeof summary>[] = [];
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: () => ({ body: { items } }),
			[`POST ${LIST_PATH}`]: () => {
				items = [summary("c9", { name: "New collection" })];
				return { status: 201, body: created };
			},
			"PATCH /api/v1/collections/c9": () => {
				items = [summary("c9", { name: "Billing" })];
				return { body: { ...created, name: "Billing" } };
			},
		});
		expect(await screen.findByText("No collections yet")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Create" }));
		await user.click(
			await screen.findByRole("menuitem", { name: "Blank collection" }),
		);
		const input = await screen.findByRole("textbox", {
			name: "New name for New collection",
		});
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			name: "New collection",
		});
		await user.clear(input);
		await user.type(input, "Billing{Enter}");
		await waitFor(() =>
			expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
				name: "Billing",
			}),
		);
		expect(await findRow("c9")).toHaveTextContent("Billing");
	});

	it("renames a request in place from its menu", async () => {
		const user = userEvent.setup();
		let saved = ORDERS;
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: {
				body: { items: [summary("c1", { requestCount: 2 })] },
			},
			"GET /api/v1/collections/c1": () => ({ body: saved }),
			"PATCH /api/v1/collections/c1/nodes/r2": () => {
				const renamed = request("r2", null, "a1", "Status");
				saved = { ...ORDERS, nodes: [...ORDERS.nodes.slice(0, 2), renamed] };
				return { body: renamed };
			},
		});
		await user.click(await findRow("c1"));
		await openMenu("r2");
		await user.click(screen.getByRole("menuitem", { name: "Rename" }));
		const input = await screen.findByRole("textbox", {
			name: "New name for Health",
		});
		await user.clear(input);
		await user.type(input, "Status{Enter}");
		expect(await findRow("r2")).toHaveTextContent("Status");
		expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
			name: "Status",
		});
		expect(row("r2")).toHaveFocus();
	});

	it("puts a starred collection first", async () => {
		const user = userEvent.setup();
		let starred = false;
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: () => ({
				body: {
					items: [
						summary("a", { name: "Alpha" }),
						summary("b", { name: "Beta", favorite: starred }),
					],
				},
			}),
			"PUT /api/v1/collections/b/favorite": () => {
				starred = true;
				return { body: { collectionId: "b", favorite: true } };
			},
		});
		const beta = await findRow("b");
		const star = within(beta).getByRole("button", {
			name: "Add Beta to favorites",
		});
		expect(star).toHaveAttribute("aria-pressed", "false");
		await user.click(star);
		await waitFor(() => {
			const ids = [...document.querySelectorAll("[data-node-id]")].map((e) =>
				e.getAttribute("data-node-id"),
			);
			expect(ids).toEqual(["b", "a"]);
		});
		expect(calls.some((c) => c.method === "PUT")).toBe(true);
		expect(
			within(await findRow("b")).getByRole("button", {
				name: "Remove Beta from favorites",
			}),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("opens a request from the tree as a tab", async () => {
		const user = userEvent.setup();
		renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			"GET /api/v1/collections/c1": { body: ORDERS },
		});
		await user.click(await findRow("c1"));
		await user.click(await findRow("r2"));
		expect(await screen.findByRole("tab", { name: /Health/ })).toBeVisible();
	});

	it("is absent while the workspaces flag is off", async () => {
		const { calls } = renderWorkbenchPage({}, { flags: FLAGS_OFF });
		expect(
			await screen.findByRole("button", { name: "History" }),
		).toHaveAttribute("aria-expanded", "true");
		expect(byId("sidebar-rail-collections")).toBeNull();
		expect(byId("sidebar-rail-trash")).toBeNull();
		expect(calls.some((c) => c.path.startsWith("/api/v1/workspaces"))).toBe(
			false,
		);
	});
});
