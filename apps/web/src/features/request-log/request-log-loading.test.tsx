import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { held } from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { stubEventSource } from "./fake-event-source";
import {
	LOGS_PATH,
	logLine,
	logRow,
	renderLogPanel,
} from "./request-log-test-utils";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const page = (items: unknown[]) => ({ body: { items, nextCursor: null } });

describe("request log, loading states", () => {
	beforeEach(() => stubEventSource());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows skeleton rows under the header while the first page is slow", async () => {
		const first = held();
		const { container } = renderLogPanel({ [`GET ${LOGS_PATH}`]: first.route });
		const region = await waitFor(() => {
			const found = byId("request-log-loading");
			if (!found) throw new Error("no skeleton yet");
			return found;
		});
		expect(region).toHaveAttribute("aria-busy", "true");
		expect(
			region.querySelectorAll('[data-id="request-log-skeleton-row"]'),
		).toHaveLength(5);
		expect(screen.getByRole("columnheader", { name: "Path" })).toBeVisible();
		// One polite status for the table, beside the live status of the stream.
		const loading = await screen.findAllByText("Loading requests…");
		expect(loading).toHaveLength(1);
		expect(loading[0]).toHaveRole("status");
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => first.release(page([logRow("a")])));
		expect(
			await screen.findByRole("button", { name: "/users/a" }),
		).toBeInTheDocument();
		expect(byId("request-log-loading")).toBeNull();
	});

	it("keeps the rows dimmed with the panel bar while a filter loads", async () => {
		const filtered = held();
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: ({ query }) =>
				query.get("method") === "POST" ? filtered.route() : page([logRow("a")]),
		});
		const row = await screen.findByRole("button", { name: "/users/a" });
		await userEvent.selectOptions(screen.getByLabelText("Method"), "POST");
		const panel = byId("request-log-panel");
		await waitFor(() =>
			expect(panel?.querySelector('[data-id="panel-progress"]')).toBeTruthy(),
		);
		expect(panel?.querySelector("[data-dimmed]")).not.toBeNull();
		expect(panel).toHaveAttribute("aria-busy", "true");
		expect(row).toBeInTheDocument();
		await act(async () =>
			filtered.release(page([logRow("b", { method: "POST" })])),
		);
		expect(
			await screen.findByRole("button", { name: "/users/b" }),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(panel?.querySelector("[data-dimmed]")).toBeNull(),
		);
		expect(screen.queryByRole("button", { name: "/users/a" })).toBeNull();
	});

	it("spins Replay on its row until the replay answers", async () => {
		const replay = held();
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
			[`GET ${LOGS_PATH}/a`]: { body: logLine("a") },
			[`POST ${LOGS_PATH}/a/replay`]: replay.route,
		});
		const button = await screen.findByRole("button", {
			name: /Replay GET \/users\/a/,
		});
		await userEvent.click(button);
		expect(button).toHaveAttribute("aria-busy", "true");
		expect(button).toHaveFocus();
		await act(async () =>
			replay.release({
				body: {
					status: 200,
					ms: 5,
					source: "mock",
					headers: [],
					body: "{}",
					bodyEncoding: "utf8",
					size: 2,
					truncated: false,
				},
			}),
		);
		await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
	});
});
