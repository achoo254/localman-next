import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeProject } from "../../test/fixtures";
import { mockUrlsJson } from "../api-client/open-in/open-in-test-utils";
import {
	LIST_PATH,
	byId,
	detail,
	renderWorkbenchPage,
	request,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const CREATE = `POST ${LIST_PATH}`;

async function openNewMenu() {
	const user = userEvent.setup();
	await waitFor(() => expect(byId("sidebar-collections-new")).not.toBeNull());
	const trigger = byId("sidebar-collections-new");
	if (trigger) await user.click(trigger);
	return { user, menu: await screen.findByRole("menu") };
}

describe("creating a collection from the New menu", () => {
	it("creates the REST CRUD template", async () => {
		const created = detail("c9", [request("r1", null, "a0", "List items")], {
			name: "REST CRUD",
		});
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			[CREATE]: { status: 201, body: created },
			"GET /api/v1/collections/c9": { body: created },
		});
		const { user, menu } = await openNewMenu();
		await user.click(
			within(menu).getByRole("menuitem", { name: "REST CRUD template" }),
		);
		expect(await screen.findByText("Created REST CRUD.")).toBeVisible();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			template: "rest-crud",
		});
	});

	it("creates one from a mock project and keeps the project as its link", async () => {
		const created = detail("c9", [], {
			name: "Demo shop",
			mockProject: { id: "p1", name: "Demo shop" },
		});
		const { calls } = renderWorkbenchPage({
			[`GET ${LIST_PATH}`]: { body: { items: [summary("c1")] } },
			"GET /api/v1/projects": {
				body: { items: [makeProject("p1", { name: "Demo shop" })] },
			},
			"GET /api/v1/projects/p1/mock-urls": { body: mockUrlsJson() },
			[CREATE]: { status: 201, body: created },
			"GET /api/v1/collections/c9": { body: created },
		});
		const { user, menu } = await openNewMenu();
		await user.click(
			within(menu).getByRole("menuitem", { name: "From mock project…" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Collection from a mock project",
		});
		expect(
			await within(dialog).findByRole("radio", { name: "Demo shop" }),
		).toBeChecked();
		await user.click(
			within(dialog).getByRole("button", { name: "Create collection" }),
		);
		expect(await screen.findByText("Created Demo shop.")).toBeVisible();
		const body = calls.find((c) => c.method === "POST")?.body;
		expect(body).toMatchObject({
			mockProjectId: "p1",
			tree: { name: "Demo shop" },
		});
	});
});
