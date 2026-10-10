import { createRequestDraft } from "@localman/shared/api-client";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLIENT_SETTINGS } from "../../features/api-client/routing/client-settings-api";
import {
	byDataId,
	renderWorkbench,
} from "../../features/api-client/workbench/workbench-test-utils";
import { seriousViolations } from "../../test/axe";
import {
	type MockReply,
	type MockRoute,
	mockFetch,
} from "../../test/mock-fetch";

/** A route whose answers wait until the test releases them. */
function held() {
	const pending: Array<(reply: MockReply) => void> = [];
	return {
		route: () =>
			new Promise<MockReply>((resolve) => {
				pending.push(resolve);
			}),
		release: (reply: MockReply) => {
			for (const resolve of pending.splice(0)) resolve(reply);
		},
	};
}

const DRAFTS = {
	body: {
		items: [
			{
				tabId: "t1",
				order: 0,
				updatedAt: "2026-10-10T00:00:00Z",
				draft: createRequestDraft({ url: "https://a.test/users" }),
			},
		],
	},
};

function entry(id: string) {
	return {
		id,
		name: "",
		method: "GET",
		url: `https://a.test/${id}`,
		response: { status: 200, ms: 5, size: 2, route: "proxy", finalUrl: null },
		bodyOmitted: false,
		createdAt: new Date().toISOString(),
	};
}

function stub(routes: Record<string, MockRoute>) {
	return mockFetch({
		"GET /api/v1/client/settings": { body: DEFAULT_CLIENT_SETTINGS },
		"GET /api/v1/client/history": { body: { items: [], nextCursor: null } },
		"GET /api/v1/client/drafts": DRAFTS,
		"POST /api/v1/client/history": { status: 201, body: entry("sent") },
		...routes,
	});
}

/** Records whether an element with `dataId` was ever added to the page. */
function watchFor(dataId: string): () => boolean {
	let seen = false;
	const observer = new MutationObserver(() => {
		seen ||= document.querySelector(`[data-id="${dataId}"]`) !== null;
	});
	observer.observe(document.body, { childList: true, subtree: true });
	return () => {
		observer.disconnect();
		return seen;
	};
}

describe("API client loading states", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows the workbench and history skeletons while drafts restore slowly", async () => {
		const drafts = held();
		const history = held();
		stub({
			"GET /api/v1/client/drafts": drafts.route,
			"GET /api/v1/client/history": history.route,
		});
		const { container } = renderWorkbench();
		const workbench = await waitFor(() => byDataId("workbench-loading"));
		expect(workbench).toHaveAttribute("aria-busy", "true");
		// No empty editor flashing before the restored tabs.
		expect(byDataId("editor-empty")).not.toBeVisible();
		expect(
			await waitFor(() => byDataId("sidebar-history-loading")),
		).toBeVisible();
		await waitFor(() =>
			expect(
				screen.getAllByRole("status").map((status) => status.textContent),
			).toEqual(expect.arrayContaining(["Loading tabs…", "Loading history…"])),
		);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => {
			drafts.release(DRAFTS);
			history.release({ body: { items: [entry("one")], nextCursor: null } });
		});
		expect(
			await screen.findByRole("tab", { name: /a\.test\/users/ }),
		).toBeVisible();
		expect(document.querySelector('[data-id="workbench-loading"]')).toBeNull();
		expect(screen.getByText("https://a.test/one")).toBeVisible();
	});

	it("shows no skeleton when the drafts come back quickly", async () => {
		stub({});
		const seen = watchFor("workbench-loading");
		renderWorkbench();
		await screen.findByRole("tablist", { name: "Open requests" });
		// Past the 150 ms delay: a skeleton would have appeared by now.
		await new Promise((resolve) => window.setTimeout(resolve, 200));
		expect(seen()).toBe(false);
	});

	it("keeps history under a panel bar while it refreshes, and spins Load older", async () => {
		let page = 0;
		const refetch = held();
		const older = held();
		stub({
			"GET /api/v1/client/history": (call) => {
				if (call.query.get("cursor")) return older.route();
				page += 1;
				return page === 1
					? { body: { items: [entry("one")], nextCursor: "c1" } }
					: refetch.route();
			},
		});
		renderWorkbench();
		const user = userEvent.setup();
		const more = await screen.findByRole("button", {
			name: "Load older requests",
		});
		await user.click(more);
		expect(more).toHaveAttribute("aria-busy", "true");
		expect(more).toHaveFocus();
		await act(async () =>
			older.release({ body: { items: [entry("two")], nextCursor: null } }),
		);
		expect(await screen.findByText("https://a.test/two")).toBeVisible();

		await user.click(byDataId("request-send"));
		const panel = byDataId("sidebar-history-list");
		await waitFor(() =>
			expect(panel.querySelector('[data-id="panel-progress"]')).not.toBeNull(),
		);
		expect(panel).toHaveAttribute("aria-busy", "true");
		expect(screen.getByText("https://a.test/one")).toBeVisible();
		await act(async () =>
			refetch.release({ body: { items: [entry("one")], nextCursor: null } }),
		);
		await waitFor(() =>
			expect(panel.querySelector('[data-id="panel-progress"]')).toBeNull(),
		);
	});
});
