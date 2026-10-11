import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall } from "../../test/mock-fetch";
import {
	chooseWorkspace,
	renderWithWorkspaces,
} from "../workspaces/workspaces-test-helpers";
import { allById, byId } from "./collections-test-utils";
import { TrashPage } from "./trash-page";

afterEach(() => vi.unstubAllGlobals());

const TRASH = "/api/v1/trash/collections";
const item = (id: string, name: string, deletedBy: string) => ({
	id,
	name,
	workspaceId: "w-team",
	workspaceName: "Team Payments",
	requestCount: 1,
	tags: [],
	status: null,
	deletedAt: "2026-10-01T00:00:00.000Z",
	deletedBy,
	deletedByName: deletedBy === "u1" ? "Minh Anh" : "Lan",
	purgeAt: "2026-10-31T00:00:00.000Z",
});
const ALL = [item("t1", "Orders API", "u1"), item("t2", "Legacy", "u2")];

/** The mock API filters like the server: deletedBy and q. */
function renderTrash(at: string) {
	chooseWorkspace("w-team");
	return renderWithWorkspaces(
		{
			[`GET ${TRASH}`]: ({ query }) => {
				const by = query.get("deletedBy");
				const q = query.get("q")?.toLowerCase();
				const items = ALL.filter(
					(row) =>
						(!by || row.deletedBy === by) &&
						(!q || row.name.toLowerCase().includes(q)),
				);
				return {
					body: {
						items,
						deleters: [
							{ id: "u1", name: "Minh Anh" },
							{ id: "u2", name: "Lan" },
						],
					},
				};
			},
		},
		{ path: "/trash", at, element: <TrashPage /> },
	);
}

const lastQuery = (calls: FetchCall[]) =>
	calls.filter((c) => c.path === TRASH).at(-1)?.query;

describe("trash filters", () => {
	it("reads the filters from the URL and sends them to the server", async () => {
		const { calls } = renderTrash("/trash?workspace=w-team&by=u2");
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
		expect(lastQuery(calls)?.get("workspaceId")).toBe("w-team");
		expect(lastQuery(calls)?.get("deletedBy")).toBe("u2");
		expect(byId("trash-filter-workspace")).toHaveValue("w-team");
		expect(byId("trash-filter-deleted-by")).toHaveValue("u2");
	});

	it("keeps a picked filter and the search in the URL", async () => {
		const user = userEvent.setup();
		const { calls, router } = renderTrash("/trash");
		await waitFor(() => expect(allById("trash-item")).toHaveLength(2));
		await user.selectOptions(
			byId("trash-filter-deleted-by") as HTMLElement,
			"u1",
		);
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
		expect(router.state.location.search).toBe("?by=u1");
		await user.type(screen.getByRole("searchbox"), "nothing");
		await waitFor(() => expect(lastQuery(calls)?.get("q")).toBe("nothing"));
		expect(router.state.location.search).toBe("?by=u1&q=nothing");
		expect(await screen.findByText("Nothing matches “nothing”.")).toBeVisible();
	});

	it("says when the filters match nothing", async () => {
		renderTrash("/trash?q=nothing");
		expect(await screen.findByText("Nothing matches “nothing”.")).toBeVisible();
		expect(byId("trash-empty")).toBeNull();
	});

	it("drops a workspace or a deleter that does not exist from the URL", async () => {
		const { calls, router } = renderTrash(
			"/trash?workspace=w-gone&by=nobody&q=or",
		);
		await waitFor(() => expect(router.state.location.search).toBe("?q=or"));
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
		expect(lastQuery(calls)?.get("workspaceId")).toBeNull();
		expect(lastQuery(calls)?.get("deletedBy")).toBeNull();
	});

	it("follows the search in the URL on back and forward", async () => {
		const { router } = renderTrash("/trash");
		await waitFor(() => expect(allById("trash-item")).toHaveLength(2));
		await act(() => router.navigate("/trash?q=legacy"));
		await waitFor(() =>
			expect(screen.getByRole("searchbox")).toHaveValue("legacy"),
		);
		await waitFor(() => expect(allById("trash-item")).toHaveLength(1));
		await act(() => router.navigate(-1));
		await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
		expect(router.state.location.search).toBe("");
	});
});
