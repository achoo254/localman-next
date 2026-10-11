import type { WorkspaceRole } from "@localman/shared/access";
import type { CollectionDetail } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LIST_PATH,
	byId,
	detail,
	findRow,
	folder,
	renderWorkbenchPage,
	request,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const DETAIL_PATH = "GET /api/v1/collections/c1";
/** A PATCH body as fields to spread (the mock API keeps what it gets). */
const fields = (body: unknown): object =>
	typeof body === "object" && body !== null ? body : {};
const SHOP = detail(
	"c1",
	[folder("f1", null, "a0", "Users"), request("r1", "f1", "a0", "List users")],
	{
		name: "Shop",
		description: "## Shop API\n\nUse **care** and [docs](https://docs.test).",
	},
);

/** The workbench with collection c1 whose PATCHes are stored and served back. */
function renderShop(
	start: CollectionDetail = SHOP,
	role: WorkspaceRole = "admin",
) {
	let stored = start;
	const api = renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: () => ({
				body: {
					items: [summary("c1", { name: stored.name, role: stored.role })],
				},
			}),
			[DETAIL_PATH]: () => ({ body: stored }),
			"PATCH /api/v1/collections/c1": ({ body }) => {
				stored = { ...stored, ...fields(body) };
				return { body: stored };
			},
			"PATCH /api/v1/collections/c1/nodes/f1": ({ body }) => {
				const node = { ...folder("f1", null, "a0", "Users"), ...fields(body) };
				return { body: node };
			},
		},
		{ role },
	);
	return { ...api, stored: () => stored };
}

const patches = (calls: { method: string; path: string; body: unknown }[]) =>
	calls.filter((c) => c.method === "PATCH");

describe("collection and folder tabs", () => {
	it("opens a collection as a tab with its Markdown description and details", async () => {
		const user = userEvent.setup();
		const { calls } = renderShop();
		await user.click(await findRow("c1"));
		expect(await screen.findByRole("tab", { name: /Shop/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		const overview = await screen.findByRole("heading", { name: "Shop API" });
		expect(overview).toBeVisible();
		expect(screen.getByText("care").tagName).toBe("STRONG");
		expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
			"href",
			"https://docs.test",
		);
		expect(byId("collection-request-count")).toHaveTextContent("1");
		await user.click(byId("collection-description-edit") as HTMLElement);
		const box = screen.getByRole("textbox", {
			name: "Description in Markdown",
		});
		await user.clear(box);
		await user.type(box, "Plain <b>text</b>");
		await user.click(byId("collection-description-save") as HTMLElement);
		await waitFor(() =>
			expect(patches(calls).at(-1)?.body).toEqual({
				description: "Plain <b>text</b>",
			}),
		);
		// Markup in a description stays text.
		expect(await screen.findByText("Plain <b>text</b>")).toBeVisible();
		expect(
			document.querySelector("[data-id=collection-description] b"),
		).toBeNull();
	});

	it("saves a renamed collection on its own and renames its tab", async () => {
		const user = userEvent.setup();
		const { calls } = renderShop();
		await user.click(await findRow("c1"));
		const name = await screen.findByRole("textbox", {
			name: "Collection name",
		});
		await user.clear(name);
		await user.type(name, "Store");
		await waitFor(
			() => expect(patches(calls).at(-1)?.body).toEqual({ name: "Store" }),
			{ timeout: 3000 },
		);
		expect(await screen.findByText("All changes saved")).toBeVisible();
		expect(screen.getByRole("tab", { name: /Store/ })).toBeVisible();
	});

	it("edits a folder's auth and saves it with Ctrl+S", async () => {
		const user = userEvent.setup();
		const { calls } = renderShop();
		await user.click(await findRow("c1"));
		await user.click(await findRow("f1"));
		await screen.findByRole("textbox", { name: "Folder name" });
		const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
		expect(tabs).toEqual(
			expect.arrayContaining(["Overview", "Authorization", "Scripts"]),
		);
		expect(byId("collection-tab-variables")).toBeNull();
		await user.click(byId("collection-tab-authorization") as HTMLElement);
		await user.selectOptions(
			screen.getByRole("combobox", { name: "Auth type" }),
			"bearer",
		);
		await user.type(screen.getByRole("textbox", { name: "Token" }), "abc");
		await user.keyboard("{Control>}s{/Control}");
		await waitFor(() =>
			expect(patches(calls).at(-1)).toMatchObject({
				path: "/api/v1/collections/c1/nodes/f1",
				body: { auth: { type: "bearer", token: "abc" } },
			}),
		);
	});

	it("adds a collection variable", async () => {
		const user = userEvent.setup();
		const { calls } = renderShop();
		await user.click(await findRow("c1"));
		await user.click(await screen.findByRole("tab", { name: "Variables" }));
		await user.click(byId("collection-variables-add") as HTMLElement);
		await user.type(
			screen.getByRole("textbox", { name: "Key of row 1" }),
			"baseUrl",
		);
		await user.type(
			screen.getByLabelText("Value of baseUrl"),
			"https://a.test",
		);
		await user.keyboard("{Control>}s{/Control}");
		await waitFor(() =>
			expect(patches(calls).at(-1)?.body).toEqual({
				variables: [{ key: "baseUrl", value: "https://a.test", enabled: true }],
			}),
		);
	});

	it("is read-only for a Viewer", async () => {
		const user = userEvent.setup();
		const { calls } = renderShop({ ...SHOP, role: "viewer" }, "viewer");
		await user.click(await findRow("c1"));
		const name = await screen.findByRole("textbox", {
			name: "Collection name",
		});
		expect(name).toHaveAttribute("readonly");
		expect(byId("collection-description-edit")).toBeNull();
		expect(screen.getByText(/You can view this collection/)).toBeVisible();
		await user.click(screen.getByRole("tab", { name: "Authorization" }));
		expect(screen.getByRole("combobox", { name: "Auth type" })).toBeDisabled();
		const page = byId("collection-page") as HTMLElement;
		expect(within(page).getByRole("button", { name: "Share" })).toBeEnabled();
		expect(patches(calls)).toHaveLength(0);
	});
});
