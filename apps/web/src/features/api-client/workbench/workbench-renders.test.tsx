import { createRequestDraft } from "@localman/shared/api-client";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HISTORY_QUERY_KEY } from "../history/use-history";
import type { ResponsePanelProps } from "../response/response-panel";
import {
	byDataId,
	renderWorkbench,
	stubClientApi,
} from "./workbench-test-utils";

/** Renders of the panels a keystroke in the editor must not touch. */
const renders = vi.hoisted(() => ({ history: 0, response: 0, tabs: 0 }));
/**
 * What each counted history render saw, for the failure message: a changed
 * `dataUpdatedAt` points at a query notification, an unchanged one at the
 * sidebar's own state (its skeleton timer) or a parent.
 */
const historyLog = vi.hoisted(() => ({ since: 0, entries: [] as string[] }));

vi.mock("../history/use-history", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../history/use-history")>();
	return {
		...actual,
		useHistoryList: () => {
			renders.history += 1;
			const result = actual.useHistoryList();
			historyLog.entries.push(
				`+${Math.round(performance.now() - historyLog.since)}ms pending=${result.isPending} fetching=${result.isFetching} dataUpdatedAt=${result.dataUpdatedAt}`,
			);
			return result;
		},
	};
});

vi.mock("../response/response-panel", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../response/response-panel")>();
	const Counted = (props: ResponsePanelProps) => {
		renders.response += 1;
		return <actual.ResponsePanel {...props} />;
	};
	return { ...actual, ResponsePanel: Counted };
});

/** Each tab item computes its label once per render. */
vi.mock("../tabs/tab-label", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../tabs/tab-label")>();
	return {
		...actual,
		tabLabel: (...args: Parameters<typeof actual.tabLabel>) => {
			renders.tabs += 1;
			return actual.tabLabel(...args);
		},
	};
});

afterEach(() => vi.unstubAllGlobals());

describe("workbench renders", () => {
	it("re-renders only the edited tab on a keystroke, not history, response or other tabs", async () => {
		const calls = stubClientApi(
			["a", "b", "c"].map((id) => ({
				tabId: id,
				draft: createRequestDraft({ url: `https://api.test/${id}` }),
			})),
		);
		const user = userEvent.setup();
		const { client } = renderWorkbench();
		await screen.findByRole("tablist", { name: "Open requests" });
		await user.click(byDataId("request-send"));
		await screen.findByText("echo GET https://api.test/a");
		// The send records history and refetches it; let that finish first,
		// or a slow machine counts its render as one of the keystrokes'.
		await waitFor(() =>
			expect(
				calls.filter(
					(c) => c.method === "GET" && c.path === "/api/v1/client/history",
				).length,
			).toBeGreaterThanOrEqual(2),
		);
		await waitFor(() =>
			expect(byDataId("sidebar-history-list")).not.toHaveAttribute("aria-busy"),
		);
		// A refetch counts once its answer is in: on a slow runner the second
		// history response used to land during the keystrokes.
		await waitFor(() => expect(client.isFetching()).toBe(0));
		// A first load slower than the loading delay shows the history skeleton,
		// which then stays at least 300 ms; hiding it renders the sidebar once.
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="sidebar-history-loading"]'),
			).toBeNull(),
		);
		const name = screen.getByRole("textbox", { name: "Request name" });
		await user.click(name);
		renders.history = 0;
		renders.response = 0;
		renders.tabs = 0;
		historyLog.since = performance.now();
		historyLog.entries = [
			`before typing: dataUpdatedAt=${client.getQueryState(HISTORY_QUERY_KEY)?.dataUpdatedAt}`,
		];

		await user.type(name, "hello");

		expect(name).toHaveValue("hello");
		expect(renders.history, historyLog.entries.join(" | ")).toBe(0);
		expect(renders.response).toBe(0);
		// One render of the edited tab per keystroke; the other two stay put.
		expect(renders.tabs).toBe(5);
	});
});
