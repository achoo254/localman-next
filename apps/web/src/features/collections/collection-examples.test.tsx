import type { CollectionExampleNode } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockRoute } from "../../test/mock-fetch";
import {
	LIST_PATH,
	byId,
	detail,
	findRow,
	folder,
	openMenu,
	renderWorkbenchPage,
	request,
	summary,
} from "./collections-test-utils";
import { blankExampleResponse } from "./example-response";

afterEach(() => vi.unstubAllGlobals());

const LIST_USERS = request("r1", "f1", "a0", "List users");
const EXAMPLE: CollectionExampleNode = {
	kind: "example",
	id: "e1",
	parentId: "r1",
	order: "a0",
	name: "All users",
	request: LIST_USERS.draft,
	response: { ...blankExampleResponse(), body: '{"users":[]}' },
};
const NODES = "/api/v1/collections/c1/nodes";

function renderShop(
	role: "editor" | "viewer" = "editor",
	routes: Record<string, MockRoute> = {},
) {
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1", { role })] } },
			"GET /api/v1/collections/c1": {
				body: detail(
					"c1",
					[folder("f1", null, "a0", "Users"), LIST_USERS, EXAMPLE],
					{ role },
				),
			},
			...routes,
		},
		{ role: role === "viewer" ? "viewer" : "admin" },
	);
}

async function expandUsers() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await user.click(await findRow("f1"));
	return user;
}

const posts = (calls: FetchCall[]) =>
	calls.filter((c) => c.method === "POST" && c.path === NODES);

describe("examples", () => {
	it("shows under their request and opens in an editor that saves with Ctrl+S", async () => {
		const { calls } = renderShop("editor", {
			[`PATCH ${NODES}/e1`]: {
				body: { ...EXAMPLE, response: { ...EXAMPLE.response, status: 404 } },
			},
		});
		const user = await expandUsers();
		const row = await findRow("e1");
		expect(row).toHaveTextContent("200 · All users");
		await user.click(row);
		const status = await screen.findByRole("spinbutton", { name: "Status" });
		await user.clear(status);
		await user.type(status, "700");
		expect(
			await screen.findByText("Use a status from 100 to 599."),
		).toBeVisible();
		await user.clear(status);
		await user.type(status, "404");
		await user.keyboard("{Control>}s{/Control}");
		await waitFor(() =>
			expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
				response: { status: 404 },
			}),
		);
	});

	it("adds a blank example from the request menu", async () => {
		const created = { ...EXAMPLE, id: "e2", name: "New example" };
		const { calls } = renderShop("editor", {
			[`POST ${NODES}`]: { status: 201, body: created },
		});
		const user = await expandUsers();
		await openMenu("r1");
		await user.click(screen.getByRole("menuitem", { name: "Add example" }));
		await waitFor(() => expect(posts(calls)).toHaveLength(1));
		expect(posts(calls)[0]?.body).toMatchObject({
			kind: "example",
			parentId: "r1",
			name: "New example",
			response: { status: 200, body: "" },
		});
	});

	it("is read-only for a Viewer", async () => {
		renderShop("viewer");
		const user = await expandUsers();
		await user.click(await findRow("e1"));
		const editor = await waitFor(() => {
			const element = byId("example-editor");
			if (!element) throw new Error("no editor");
			return element;
		});
		expect(
			within(editor).getByRole("spinbutton", { name: "Status" }),
		).toHaveAttribute("readonly");
		expect(byId("example-save")).toBeNull();
		expect(byId("example-duplicate")).toBeNull();
	});

	it("saves a response of a bound request as an example", async () => {
		const { calls } = renderShop("editor", {
			[`POST ${NODES}`]: {
				status: 201,
				body: { ...EXAMPLE, id: "e3", name: "200 OK" },
			},
		});
		const user = await expandUsers();
		await user.click(await findRow("r1"));
		await user.click(await screen.findByRole("button", { name: "Send" }));
		const saveButton = await screen.findByRole("button", {
			name: "Save as example",
		});
		// An edit after sending is not what produced the response.
		await user.type(screen.getByRole("textbox", { name: "URL" }), "?x=1");
		await user.click(saveButton);
		expect(await screen.findByText("Saved the example 200 OK.")).toBeVisible();
		expect(posts(calls)[0]?.body).toMatchObject({
			kind: "example",
			parentId: "r1",
			name: "200 OK",
			request: { url: "https://api.test/r1" },
			response: { status: 200, body: "echo GET https://api.test/r1" },
		});
	});
});
