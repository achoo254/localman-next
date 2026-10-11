import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockRoute } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	chooseWorkspace,
	renderWithWorkspaces,
} from "../workspaces/workspaces-test-helpers";
import type { TrashedCollection } from "./collection-parsers";
import { FLAGS_OFF, allById, byId } from "./collections-test-utils";
import { TrashPage } from "./trash-page";

afterEach(() => vi.unstubAllGlobals());

const DAY = 24 * 60 * 60 * 1000;
const TRASH = "/api/v1/trash/collections";

function trashed(
	id: string,
	daysLeft: number,
	overrides: Partial<TrashedCollection> = {},
): TrashedCollection {
	return {
		id,
		name: `Collection ${id}`,
		workspaceId: "w-team",
		workspaceName: "Team Payments",
		deletedAt: new Date(Date.now() - (30 - daysLeft) * DAY).toISOString(),
		deletedBy: "user-1",
		deletedByName: "Minh Anh",
		purgeAt: new Date(Date.now() + daysLeft * DAY - 60_000).toISOString(),
		requestCount: 3,
		tags: [],
		status: null,
		...overrides,
	};
}

const ITEMS = [
	trashed("t1", 25, { name: "Orders API" }),
	trashed("t2", 5, {
		name: "Legacy",
		workspaceName: null,
		deletedByName: null,
	}),
];

function renderTrash(routes: Record<string, MockRoute>, flags = FLAGS_ON) {
	chooseWorkspace("w-team");
	return renderWithWorkspaces(routes, {
		path: "/trash",
		at: "/trash",
		element: <TrashPage />,
		flags,
	});
}

describe("trash page", () => {
	it("lists deleted collections with the days they have left", async () => {
		renderTrash({ [`GET ${TRASH}`]: { body: { items: ITEMS } } });
		await waitFor(() => expect(allById("trash-item")).toHaveLength(2));
		expect(byId("trash-retention")).toHaveTextContent("kept for 30 days");
		const [orders, legacy] = allById("trash-item");
		expect(orders).toHaveTextContent("Team Payments");
		expect(orders).toHaveTextContent("Minh Anh");
		expect(orders).toHaveTextContent("3 requests");
		expect(within(orders as HTMLElement).getByText("25 days")).not.toHaveClass(
			"text-warning-text",
		);
		expect(legacy).toHaveTextContent("Deleted workspace");
		expect(legacy).toHaveTextContent("Removed account");
		expect(
			(legacy as HTMLElement).querySelector('[data-id="trash-item-days"]'),
		).toHaveClass("text-warning-text");
	});

	it("restores into the workspace picked in the dialog", async () => {
		const user = userEvent.setup();
		let items = ITEMS;
		const { calls } = renderTrash({
			[`GET ${TRASH}`]: () => ({ body: { items } }),
			[`POST ${TRASH}/t1/restore`]: () => {
				items = ITEMS.slice(1);
				return { body: {} };
			},
		});
		await waitFor(() => expect(allById("trash-item")).toHaveLength(2));
		await user.click(
			screen.getByRole("button", { name: "Restore Orders API" }),
		);
		const dialog = await screen.findByRole("dialog");
		const select = within(dialog).getByRole("combobox");
		expect(select).toHaveValue("w-team");
		await user.selectOptions(select, "w-personal");
		await user.click(within(dialog).getByRole("button", { name: "Restore" }));
		expect(
			await screen.findByText("Restored Orders API into Minh Anh's workspace."),
		).toBeVisible();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			workspaceId: "w-personal",
		});
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
	});

	it("deletes for good after confirming", async () => {
		const user = userEvent.setup();
		let items = ITEMS;
		const { calls } = renderTrash({
			[`GET ${TRASH}`]: () => ({ body: { items } }),
			[`DELETE ${TRASH}/t2`]: () => {
				items = ITEMS.slice(0, 1);
				return { body: { deleted: true } };
			},
		});
		await waitFor(() => expect(allById("trash-item")).toHaveLength(2));
		await user.click(
			screen.getByRole("button", { name: "Delete Legacy permanently" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("Delete “Legacy” for good?")).toBeVisible();
		await user.click(
			within(dialog).getByRole("button", { name: "Delete permanently" }),
		);
		expect(await screen.findByText("Deleted Legacy for good.")).toBeVisible();
		expect(calls.some((c) => c.method === "DELETE")).toBe(true);
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
		expect(screen.getByRole("searchbox")).toHaveFocus();
	});

	it("says so when the Trash is empty", async () => {
		renderTrash({ [`GET ${TRASH}`]: { body: { items: [] } } });
		expect(await screen.findByText("The Trash is empty")).toBeVisible();
		expect(byId("trash-table")).toBeNull();
	});

	it("sends people back to the workbench while the flag is off", async () => {
		renderTrash({}, FLAGS_OFF);
		expect(await screen.findByText("Workbench page")).toBeVisible();
	});
});
