import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LIST_PATH,
	ORDERS,
	allById,
	byId,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const SEARCH = "GET /api/v1/workspaces/w-team/collections/search";
const MATCHES = [
	{
		collectionId: "c1",
		collectionName: "Orders",
		nodeId: "f1",
		kind: "folder",
		name: "Users",
		path: [],
	},
	{
		collectionId: "c1",
		collectionName: "Orders",
		nodeId: "r1",
		kind: "request",
		name: "List users",
		method: "GET",
		path: ["Users"],
	},
];

function renderSearch(truncated = false) {
	return renderWorkbenchPage({
		[`GET ${LIST_PATH}`]: {
			body: { items: [summary("c1", { name: "Orders" }), summary("c2")] },
		},
		[SEARCH]: { body: { matches: MATCHES, truncated } },
		"GET /api/v1/collections/c1": { body: ORDERS },
	});
}

async function typeQuery(text: string) {
	const user = userEvent.setup();
	await findRow("c2");
	await user.type(
		screen.getByRole("searchbox", { name: "Search collections" }),
		text,
	);
	return user;
}

describe("collections search", () => {
	it("asks the server once typing settles, and lists matches with their path", async () => {
		const { calls } = renderSearch();
		await typeQuery("users");
		await waitFor(() =>
			expect(allById("sidebar-search-result")).toHaveLength(2),
		);
		const searches = calls.filter((c) =>
			c.path.endsWith("/collections/search"),
		);
		expect(searches.map((c) => c.query.get("q"))).toEqual(["users"]);
		const [, request] = allById("sidebar-search-result");
		expect(request).toHaveTextContent("GET");
		expect(request).toHaveTextContent("Orders / Users");
		expect(request?.querySelector("mark")).toHaveTextContent("users");
		// No collection is fetched to search it.
		expect(calls.some((c) => c.path === "/api/v1/collections/c2")).toBe(false);
		expect(byId("sidebar-tree")).toBeNull();
	});

	it("moves through results with the arrow keys and opens a request", async () => {
		renderSearch();
		const user = await typeQuery("users");
		await waitFor(() =>
			expect(allById("sidebar-search-result")).toHaveLength(2),
		);
		const [folderResult, requestResult] = allById("sidebar-search-result");
		folderResult?.focus();
		await user.keyboard("{ArrowDown}");
		expect(requestResult).toHaveFocus();
		await user.keyboard("{Enter}");
		expect(
			await screen.findByRole("tab", { name: /List users/ }),
		).toBeVisible();
	});

	it("says when there are more matches than shown", async () => {
		renderSearch(true);
		await typeQuery("u");
		const list = await screen.findByRole("list", { name: "Search results" });
		expect(within(list).getAllByRole("button")).toHaveLength(2);
		expect(screen.getByText(/Showing the first 100 matches/)).toBeVisible();
	});
});
