import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import { example } from "./collections-fixtures";
import {
	LIST_PATH,
	ORDERS,
	findRow,
	openMenu,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const ROUTES: Record<string, MockRoute> = {
	[`GET ${LIST_PATH}`]: {
		body: { items: [summary("c1", { name: "Orders" })] },
	},
	"GET /api/v1/elements/collection/c1": {
		body: {
			type: "collection",
			id: "c1",
			name: "Orders",
			workspaceId: "w-team",
			role: "editor",
		},
	},
	"GET /api/v1/collections/c1": {
		body: {
			...ORDERS,
			name: "Orders",
			nodes: [...ORDERS.nodes, example("e1", "r2", "a0", "Healthy")],
		},
	},
};

const openLink = (node: string) =>
	renderWorkbenchPage(ROUTES, { at: `/elements/collection/c1?node=${node}` });

describe("links to folders and requests", () => {
	it("copies a link naming the collection and the node", async () => {
		const user = userEvent.setup();
		renderWorkbenchPage(ROUTES);
		await user.click(await findRow("c1"));
		for (const node of ["f1", "r2", "e1"]) {
			await openMenu(node);
			await user.click(screen.getByRole("menuitem", { name: "Copy link" }));
			expect(await navigator.clipboard.readText()).toBe(
				`${window.location.origin}/elements/collection/c1?node=${node}`,
			);
		}
		expect(
			(
				await screen.findAllByText(
					"Link copied. Only people with access can open it.",
				)
			).length,
		).toBeGreaterThan(0);
	});

	it("opens a folder link as the folder's page", async () => {
		openLink("f1");
		expect(await screen.findByRole("tab", { name: /Users/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(
			await screen.findByRole("textbox", { name: "Folder name" }),
		).toHaveValue("Users");
	});

	it("opens a request link as a tab bound to the request", async () => {
		openLink("r1");
		expect(
			await screen.findByRole("tab", { name: /List users/ }),
		).toHaveAttribute("aria-selected", "true");
		const crumbs = await screen.findByRole("navigation", {
			name: "Collection path",
		});
		expect(crumbs).toHaveTextContent("OrdersUsersList users");
		expect(within(crumbs).getByRole("button", { name: "Users" })).toBeVisible();
	});

	it("opens an example link as the example's page", async () => {
		openLink("e1");
		expect(await screen.findByRole("tab", { name: /Healthy/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("opens the collection, with a note, when the node is gone", async () => {
		openLink("gone1");
		expect(
			await screen.findByText(
				"That item is no longer in Orders, so the collection opened instead.",
			),
		).toBeVisible();
		expect(await screen.findByRole("tab", { name: /Orders/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});
});
