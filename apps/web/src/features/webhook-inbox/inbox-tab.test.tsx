import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import {
	BASE,
	byId,
	findCreate,
	inboxJson,
	listJson,
	renderInboxTab,
} from "./inbox-test-utils";

const FORWARDED = inboxJson("stripe", {
	forward: { port: 3000, path: "/hooks", target: "tunnel:3000/hooks" },
	requestCount: 7,
	lastForward: {
		at: "2026-10-10T02:00:00.000Z",
		ok: false,
		status: null,
		ms: 12,
		attempts: [
			{ at: "2026-10-10T02:00:00.000Z", error: "no_tunnel", ms: 3 },
			{ at: "2026-10-10T02:00:01.000Z", status: 503, ms: 9 },
		],
	},
});

describe("inbox tab", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("lists inboxes with their URL, requests and last forward", async () => {
		const { onShowLogs, container } = renderInboxTab(listJson([FORWARDED]));
		const item = await screen.findByText("stripe");
		expect(byId("inbox-count")).toHaveTextContent("1 / 2 inboxes");
		const row = item.closest("li");
		if (!row) throw new Error("no inbox row");
		expect(
			within(row).getByText("Answers 200 · application/json"),
		).toBeInTheDocument();
		expect(byId("inbox-item-target")).toHaveTextContent(
			"Forwards to tunnel:3000/hooks",
		);
		expect(byId("inbox-item-attempts-1")).toHaveTextContent(
			"Attempt 1/33 msNo tunnel mapping for this port",
		);
		expect(byId("inbox-item-attempts-2")).toHaveTextContent("503");
		expect(byId("inbox-item-tunnel-status")).toHaveAttribute(
			"data-state",
			"missing",
		);

		const user = userEvent.setup();
		await user.click(
			screen.getByRole("button", { name: "Copy URL of inbox stripe" }),
		);
		expect(await navigator.clipboard.readText()).toBe(
			"https://secretp1.mock.localman.test/_inbox/stripe",
		);
		await user.click(
			screen.getByRole("button", {
				name: "See the 7 requests of inbox stripe in the request log",
			}),
		);
		expect(onShowLogs).toHaveBeenCalledWith({
			source: "inbox",
			path: "/_inbox/stripe",
		});
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("opens the plans when the plan has no room left", async () => {
		const full = renderInboxTab(listJson([inboxJson("a"), inboxJson("b")]));
		const user = userEvent.setup();
		await user.click(await findCreate());
		expect(full.onPlanLimit).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("deletes an inbox after confirming", async () => {
		const { calls } = renderInboxTab(listJson([inboxJson("stripe")]), {
			[`DELETE ${BASE}/stripe`]: { body: { dryRun: false, name: "stripe" } },
		});
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("button", { name: "Delete inbox stripe" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete webhook inbox",
		});
		expect(calls.some((call) => call.method === "DELETE")).toBe(false);
		await user.click(
			within(dialog).getByRole("button", { name: "Delete inbox" }),
		);
		await findToast("Deleted inbox stripe.");
		expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
	});

	it("is read only for a collaborator", async () => {
		const { onShowLogs } = renderInboxTab(
			listJson([FORWARDED], { canManage: false }),
		);
		await screen.findByText("stripe");
		expect(byId("inbox-readonly")).toHaveTextContent("Only the project owner");
		expect(screen.queryByRole("button", { name: "Create inbox" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Delete inbox stripe" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Edit inbox stripe" }),
		).toBeNull();
		await userEvent.setup().click(byId("inbox-item-view-log") ?? document.body);
		expect(onShowLogs).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state", async () => {
		const { container } = renderInboxTab(listJson([]));
		expect(await screen.findByText("No inboxes yet")).toBeInTheDocument();
		expect(byId("inbox-empty-new")).toBeInTheDocument();
		expect(await seriousViolations(container)).toEqual([]);
	});
});
