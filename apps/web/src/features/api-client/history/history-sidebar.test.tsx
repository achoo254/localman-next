import { createRequestDraft } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { seriousViolations } from "../../../test/axe";
import { mockFetch } from "../../../test/mock-fetch";
import { createTestQueryClient } from "../../../test/render-app";
import { findToast } from "../../../test/toast";
import { HistorySidebar } from "./history-sidebar";

const BASE = "/api/v1/client/history";
const DAY_MS = 24 * 60 * 60 * 1000;

function summary(id: string, ago: number, method = "GET", status = 200) {
	return {
		id,
		name: "",
		method,
		url: `https://api.example.com/${id}`,
		response: { status, ms: 12, size: 20, route: "proxy", finalUrl: null },
		bodyOmitted: false,
		createdAt: new Date(Date.now() - ago).toISOString(),
	};
}

const ITEMS = [
	summary("users", 0),
	summary("orders", DAY_MS, "POST", 201),
	summary("old", 10 * DAY_MS, "DELETE", 500),
];

function renderSidebar(onOpen = vi.fn()) {
	render(
		<QueryClientProvider client={createTestQueryClient()}>
			<ToastProvider>
				<HistorySidebar onOpen={onOpen} />
			</ToastProvider>
		</QueryClientProvider>,
	);
	return onOpen;
}

describe("HistorySidebar", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("groups requests by day and filters them", async () => {
		mockFetch({
			[`GET ${BASE}`]: { body: { items: ITEMS, nextCursor: null } },
		});
		renderSidebar();
		const today = await screen.findByRole("region", { name: "Today" });
		expect(within(today).getAllByRole("listitem")).toHaveLength(1);
		expect(screen.getByRole("region", { name: "Yesterday" })).toHaveTextContent(
			"POST",
		);
		expect(
			screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
		).toHaveLength(3);

		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Method" }),
			"DELETE",
		);
		const items = document.querySelectorAll('[data-id="sidebar-history-item"]');
		expect(items).toHaveLength(1);
		expect(items[0]).toHaveTextContent("DEL");
		expect(items[0]).toHaveTextContent("500");
	});

	it("opens the stored request of an entry", async () => {
		const draft = createRequestDraft({
			method: "GET",
			url: "https://api.example.com/users",
		});
		mockFetch({
			[`GET ${BASE}`]: { body: { items: ITEMS, nextCursor: null } },
			[`GET ${BASE}/users`]: { body: { ...ITEMS[0], draft } },
		});
		const onOpen = renderSidebar();
		await userEvent.click(
			await screen.findByRole("button", {
				name: /^Open GET https:\/\/api\.example\.com\/users in a new tab \(/,
			}),
		);
		await vi.waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
		expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ id: "users", draft });
	});

	it("loads older pages by cursor", async () => {
		const { calls } = mockFetch({
			[`GET ${BASE}`]: (call) =>
				call.query.get("cursor") === "c1"
					? {
							body: {
								items: [summary("older", 30 * DAY_MS)],
								nextCursor: null,
							},
						}
					: { body: { items: ITEMS, nextCursor: "c1" } },
		});
		renderSidebar();
		await userEvent.click(
			await screen.findByRole("button", { name: "Load older requests" }),
		);
		expect(
			await screen.findByRole("button", {
				name: /^Open GET https:\/\/api\.example\.com\/older in a new tab \(/,
			}),
		).toBeInTheDocument();
		expect(calls.map((c) => c.query.get("cursor"))).toEqual([null, "c1"]);
	});

	it("deletes one entry, and clears all only after confirming", async () => {
		const { calls } = mockFetch({
			[`GET ${BASE}`]: { body: { items: ITEMS, nextCursor: null } },
			[`DELETE ${BASE}/old`]: {
				body: { id: "old", deleted: true, dryRun: false },
			},
			[`DELETE ${BASE}`]: (call) => ({
				body: {
					entryCount: 3,
					deleted: call.query.get("dryRun") !== "true",
					dryRun: call.query.get("dryRun") === "true",
				},
			}),
		});
		renderSidebar();
		await userEvent.click(
			await screen.findByRole("button", {
				name: "Delete DELETE https://api.example.com/old from history",
			}),
		);
		await findToast("Removed the request from history.");

		await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
		const dialog = await screen.findByRole("dialog", { name: "Clear history" });
		expect(
			await within(dialog).findByText(/3 requests will be deleted/),
		).toBeInTheDocument();
		expect(
			calls.filter((c) => c.method === "DELETE" && c.path === BASE),
		).toHaveLength(1);
		expect(await seriousViolations(dialog)).toEqual([]);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Clear history" }),
		);
		await findToast("Cleared the history.");
		const clears = calls.filter(
			(c) => c.method === "DELETE" && c.path === BASE,
		);
		expect(clears.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
	});

	it("says when there is no history yet", async () => {
		mockFetch({ [`GET ${BASE}`]: { body: { items: [], nextCursor: null } } });
		renderSidebar();
		expect(
			await screen.findByText("No requests sent yet."),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
	});
});
