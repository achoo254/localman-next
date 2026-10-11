import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	LIST_PATH,
	byId,
	detail,
	renderWorkbenchPage,
} from "./collections-test-utils";

const COLLECTION = JSON.stringify({
	info: {
		name: "Shop",
		schema:
			"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
	},
	variable: [{ key: "baseUrl", value: "https://shop.test" }],
	item: [
		{ name: "List", request: { method: "GET", url: "{{baseUrl}}/items" } },
		{
			name: "Orders",
			item: [
				{ name: "", request: { method: "POST", url: "{{baseUrl}}/orders" } },
			],
		},
	],
});

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("import into collections", () => {
	it("saves the whole import as a collection of the current workspace", async () => {
		const user = userEvent.setup();
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [] } },
			[`POST ${LIST_PATH}`]: {
				status: 201,
				body: detail("c5", [], { name: "Shop" }),
			},
		});
		await waitFor(() =>
			expect(byId("sidebar-collections-import")).not.toBeDisabled(),
		);
		await user.click(byId("sidebar-collections-import") as HTMLElement);
		const dialog = await screen.findByRole("dialog", { name: "Import" });
		expect(
			within(dialog).getByRole("button", { name: "Save as collection" }),
		).toHaveAttribute("aria-pressed", "true");
		expect(dialog).toHaveTextContent("Saved in Team Payments");
		await user.click(
			within(dialog).getByRole("textbox", { name: "Content to import" }),
		);
		await user.paste(COLLECTION);
		await within(dialog).findByText(/Detected Collection v2.1/);
		await user.click(
			within(dialog).getByRole("button", { name: "Save collection" }),
		);
		expect(
			await screen.findByText("Saved Shop to Team Payments."),
		).toBeVisible();
		const body = calls.find((c) => c.method === "POST")?.body;
		expect(body).toMatchObject({
			tree: {
				name: "Shop",
				variables: [{ key: "baseUrl", value: "https://shop.test" }],
				items: [
					{ kind: "request", name: "List" },
					{
						kind: "folder",
						name: "Orders",
						items: [{ kind: "request", name: "{{baseUrl}}/orders" }],
					},
				],
			},
		});
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("still opens requests as tabs from the history import", async () => {
		const user = userEvent.setup();
		renderWorkbenchPage({ [`GET ${LIST_PATH}`]: { body: { items: [] } } });
		await user.click(await screen.findByRole("button", { name: "History" }));
		await user.click(byId("sidebar-import") as HTMLElement);
		const dialog = await screen.findByRole("dialog", { name: "Import" });
		expect(
			within(dialog).getByRole("button", { name: "Open as tabs" }),
		).toHaveAttribute("aria-pressed", "true");
	});
});
