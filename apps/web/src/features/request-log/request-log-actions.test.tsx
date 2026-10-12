import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { findToast } from "../../test/toast";
import { stubEventSource } from "./fake-event-source";
import {
	LOGS_PATH,
	PROJECT_ID,
	SETTINGS_PATH,
	logLine,
	logRow,
	renderLogPanel,
	settingsJson,
} from "./request-log-test-utils";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const page = (items: unknown[]) => ({ body: { items, nextCursor: null } });

describe("request log, rows", () => {
	beforeEach(() => stubEventSource());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows a request with masked headers, body and response source", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
			[`GET ${LOGS_PATH}/a`]: { body: logLine("a") },
		});
		expect(byId("request-log-detail")).toBeNull();
		const path = await screen.findByRole("button", { name: "/users/a" });
		expect(path).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(path);
		expect(path).toHaveAttribute("aria-pressed", "true");
		const masked = await waitFor(() => {
			const row = byId("request-log-header-authorization");
			if (!row) throw new Error("no headers yet");
			return row;
		});
		expect(masked).toHaveTextContent("[redacted]");
		expect(masked).toHaveTextContent("masked");
		expect(byId("request-log-detail-response")).toHaveTextContent(
			"200 · 12 ms · X-Localman-Source: mock",
		);
		expect(byId("request-log-detail-response-body")).toHaveTextContent(
			'"name": "An"',
		);
		expect(path.getAttribute("aria-controls")).toBe(
			byId("request-log-detail")?.closest("section")?.id,
		);
	});

	it("replays a request and shows the answer", async () => {
		const { calls } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
			[`GET ${LOGS_PATH}/a`]: { body: logLine("a") },
			[`POST ${LOGS_PATH}/a/replay`]: {
				body: {
					status: 201,
					headers: [],
					body: '{"ok":true}',
					bodyEncoding: "utf8",
					size: 11,
					truncated: false,
					ms: 9,
					source: "upstream",
				},
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Replay GET /users/a" }),
		);
		await findToast("Replayed GET /users/a through the upstream.");
		expect(calls.some((call) => call.method === "POST")).toBe(true);
		const result = await waitFor(() => {
			const region = byId("request-log-replay-result");
			if (!region) throw new Error("no replay yet");
			return region;
		});
		expect(result).toHaveTextContent(
			"201 · 9 ms · X-Localman-Source: upstream",
		);
		expect(result).toHaveTextContent('"ok": true');
	});

	it("reports a replay the API refuses", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
			[`POST ${LOGS_PATH}/a/replay`]: {
				status: 409,
				body: {
					error: { code: "REPLAY_BODY_TRUNCATED", message: "Body was cut." },
				},
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Replay GET /users/a" }),
		);
		const toast = await findToast("Couldn't replay this request");
		expect(toast).toHaveTextContent("Body was cut.");
	});

	it("has no Replay on callback rows", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([
				logRow("c", { source: "callback", method: "POST" }),
			]),
		});
		await screen.findByText("/users/c");
		expect(screen.queryByRole("button", { name: /^Replay/ })).toBeNull();
		expect(
			screen.getByRole("button", {
				name: "Open in API Client: POST /users/c",
			}),
		).toBeInTheDocument();
	});

	it("opens the request in the API client, handing over ids only", async () => {
		const { router } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
		});
		await userEvent.click(
			await screen.findByRole("button", {
				name: "Open in API Client: GET /users/a",
			}),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/api-client"),
		);
		expect(router.state.location.state).toEqual({
			openInApiClient: { projectId: PROJECT_ID, logId: "a" },
		});
	});

	it("hides Open in API Client while the API client is not released", async () => {
		renderLogPanel(
			{ [`GET ${LOGS_PATH}`]: page([logRow("a")]) },
			{ flags: { ...NO_FEATURES, hybridMock: true } },
		);
		await screen.findByText("/users/a");
		expect(byId("request-log-open-client")).toBeNull();
		expect(byId("request-log-replay")).not.toBeNull();
	});

	it("clears the whole log after a confirmation with the count", async () => {
		let items = [logRow("a"), logRow("b")];
		const { calls } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: () => page(items),
			[`DELETE ${LOGS_PATH}`]: (call) => {
				const dryRun = call.query.get("dryRun") === "true";
				if (!dryRun) items = [];
				return { body: { dryRun, deleted: 2 } };
			},
		});
		await screen.findByText("/users/a");
		await userEvent.click(screen.getByRole("button", { name: "Clear log" }));
		const dialog = await screen.findByRole("dialog", { name: "Clear log" });
		expect(
			await within(dialog).findByText("2 requests will be removed."),
		).toBeVisible();
		expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Clear log" }),
		);
		await findToast("Cleared the request log.");
		const deletes = calls.filter((call) => call.method === "DELETE");
		expect(deletes.map((call) => call.query.get("dryRun"))).toEqual([
			"true",
			null,
		]);
		await waitFor(() => expect(byId("request-log-empty")).not.toBeNull());
	});

	it("gives collaborators no Clear log", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
			[`GET ${SETTINGS_PATH}`]: {
				body: settingsJson({ canManage: false, plan: "pro", logDays: 30 }),
			},
		});
		await screen.findByText("/users/a");
		await waitFor(() =>
			expect(byId("request-log-retention")).toHaveTextContent(
				"Logs are kept for 30 days.",
			),
		);
		expect(screen.queryByRole("button", { name: "Clear log" })).toBeNull();
	});
});
