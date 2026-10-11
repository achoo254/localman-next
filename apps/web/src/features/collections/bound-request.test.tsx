import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
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

const NODE = "/api/v1/collections/c1/nodes/r1";
const USERS = {
	...folder("f1", null, "a0", "Users"),
	auth: { type: "bearer" as const, token: "t0k" },
};
const LIST_USERS = request("r1", "f1", "a0", "List users");
const SHOP = detail(
	"c1",
	[
		USERS,
		{
			...LIST_USERS,
			draft: { ...LIST_USERS.draft, auth: { type: "inherit" } },
		},
	],
	{
		name: "Shop",
	},
);

function renderShop(routes: Record<string, MockRoute> = {}) {
	return renderWorkbenchPage({
		[`GET ${LIST_PATH}`]: {
			body: {
				items: [
					summary("c1", { name: "Shop", requestCount: 1 }),
					summary("c2", { name: "Read only", role: "viewer" }),
				],
			},
		},
		"GET /api/v1/collections/c1": { body: SHOP },
		...routes,
	});
}

async function openListUsers() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await findRow("f1"));
	await user.click(await findRow("r1"));
	await screen.findByRole("tab", { name: /List users/ });
	return user;
}

describe("requests bound to a collection", () => {
	it("shows the breadcrumb, whose parents open their tabs", async () => {
		renderShop();
		const user = await openListUsers();
		const crumbs = await screen.findByRole("navigation", {
			name: "Collection path",
		});
		expect(crumbs).toHaveTextContent("ShopUsersList users");
		await user.click(within(crumbs).getByRole("button", { name: "Users" }));
		expect(
			await screen.findByRole("textbox", { name: "Folder name" }),
		).toHaveValue("Users");
	});

	it("names where inherited auth comes from, with a link to it", async () => {
		renderShop();
		const user = await openListUsers();
		await user.click(screen.getByRole("tab", { name: "Authorization" }));
		const note = byId("auth-inherit-source") as HTMLElement;
		expect(note).toHaveTextContent("Inherited from folder Users");
		await user.click(within(note).getByRole("button", { name: "Users" }));
		expect(
			await screen.findByRole("textbox", { name: "Folder name" }),
		).toBeVisible();
	});

	it("saves its draft to the node with Ctrl+S and turns clean", async () => {
		const { calls } = renderShop({
			[`PATCH ${NODE}`]: ({ body }) => ({
				body: {
					...LIST_USERS,
					...(typeof body === "object" && body ? body : {}),
				},
			}),
		});
		const user = await openListUsers();
		const url = screen.getByRole("textbox", { name: "URL" });
		await user.type(url, "?page=2");
		expect(await screen.findByText("Unsaved")).toBeVisible();
		await user.keyboard("{Control>}s{/Control}");
		await waitFor(() => expect(screen.queryByText("Unsaved")).toBeNull());
		const patch = calls.find((c) => c.method === "PATCH" && c.path === NODE);
		expect(patch?.body).toMatchObject({
			draft: { url: "https://api.test/r1?page=2" },
		});
		// The name did not change in the tab: the node keeps its own.
		expect(patch?.body).not.toHaveProperty("name");
		// The tab's draft keeps its binding on the server.
		await waitFor(() =>
			expect(
				calls.some(
					(c) =>
						c.method === "PUT" &&
						JSON.stringify(c.body).includes(
							'"source":{"collectionId":"c1","nodeId":"r1"}',
						),
				),
			).toBe(true),
		);
	});

	it("keeps the edits as a loose request when the node is gone", async () => {
		renderShop({
			[`PATCH ${NODE}`]: {
				status: 404,
				body: { error: { code: "NODE_NOT_FOUND", message: "gone" } },
			},
		});
		const user = await openListUsers();
		await user.click(byId("request-head-save") as HTMLElement);
		expect(await screen.findByText("Kept as a loose request")).toBeVisible();
		expect(
			screen.queryByRole("navigation", { name: "Collection path" }),
		).toBeNull();
		await user.click(byId("request-head-save") as HTMLElement);
		expect(
			await screen.findByRole("dialog", { name: "Save to collection" }),
		).toBeVisible();
	});

	it("saves a loose request into a collection folder, then binds it", async () => {
		const created = request("r9", "f1", "a1", "Health");
		const { calls } = renderShop({
			"POST /api/v1/collections/c1/nodes": { status: 201, body: created },
		});
		const user = userEvent.setup();
		await waitFor(() => expect(byId("tabbar-new")).not.toBeNull());
		await user.click(byId("tabbar-new") as HTMLElement);
		await user.type(
			screen.getByRole("textbox", { name: "URL" }),
			"https://a.test/health",
		);
		await user.click(byId("request-head-save") as HTMLElement);
		const dialog = await screen.findByRole("dialog", {
			name: "Save to collection",
		});
		const collection = within(dialog).getByRole("combobox", {
			name: "Collection",
		});
		expect(
			within(collection)
				.getAllByRole("option")
				.map((o) => o.textContent),
		).toEqual(["Shop"]);
		const folderBox = within(dialog).getByRole("combobox", { name: "Folder" });
		await waitFor(() => expect(folderBox).toBeEnabled());
		await user.selectOptions(folderBox, "f1");
		const name = within(dialog).getByRole("textbox", { name: "Request name" });
		await user.clear(name);
		await user.type(name, "Health");
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Saved Health to Shop.")).toBeVisible();
		expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
			kind: "request",
			parentId: "f1",
			name: "Health",
			draft: { url: "https://a.test/health", name: "Health" },
		});
		expect(screen.queryByText("Unsaved")).toBeNull();
		expect(screen.getByRole("tab", { name: /Health/ })).toBeVisible();
	});
});
