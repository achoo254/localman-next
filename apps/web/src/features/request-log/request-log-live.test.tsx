import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { FakeEventSource, stubEventSource } from "./fake-event-source";
import {
	LOGS_PATH,
	logLine,
	logRow,
	renderLogPanel,
} from "./request-log-test-utils";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const rows = () => [
	...document.querySelectorAll('[data-id="request-log-row"]'),
];
const page = (items: unknown[]) => ({ body: { items, nextCursor: null } });

function setVisibility(state: "visible" | "hidden") {
	Object.defineProperty(document, "visibilityState", {
		value: state,
		configurable: true,
	});
	act(() => {
		document.dispatchEvent(new Event("visibilitychange"));
	});
}

describe("request log, live", () => {
	beforeEach(() => {
		stubEventSource();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		setVisibility("visible");
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("puts rows from the live stream on top of the history", async () => {
		renderLogPanel({ [`GET ${LOGS_PATH}`]: page([logRow("a")]) });
		expect(await screen.findByText("/users/a")).toBeInTheDocument();
		const stream = FakeEventSource.latest();
		expect(stream.url).toBe(`${LOGS_PATH}/stream`);
		expect(stream.withCredentials).toBe(true);
		stream.open();
		expect(byId("request-log-status")).toHaveAttribute("data-state", "live");
		stream.emit(
			logRow("b", {
				at: "2026-10-10T03:06:00.000Z",
				path: "/orders",
				query: "page=2",
				source: "upstream",
				status: 502,
			}),
		);
		stream.emit({ not: "a row" });
		expect(rows()).toHaveLength(2);
		expect(rows()[0]).toHaveTextContent("/orders?page=2");
		expect(rows()[0]).toHaveTextContent("Upstream");
		expect(rows()[0]).toHaveAttribute("data-fresh", "true");
		expect(rows()[1]).toHaveTextContent("/users/a");
	});

	it("says the connection is lost, keeps the rows and reloads after it is back", async () => {
		const { calls } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([logRow("a")]),
		});
		await screen.findByText("/users/a");
		const stream = FakeEventSource.latest();
		stream.open();
		stream.fail();
		const status = byId("request-log-status");
		expect(status).toHaveAttribute("data-state", "reconnecting");
		expect(status).toHaveTextContent("Connection lost, retrying…");
		expect(rows()).toHaveLength(1);
		stream.open();
		expect(status).toHaveAttribute("data-state", "live");
		await waitFor(() =>
			expect(calls.filter((call) => call.path === LOGS_PATH)).toHaveLength(2),
		);
	});

	it("opens a refused stream again after a pause", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		renderLogPanel({ [`GET ${LOGS_PATH}`]: page([]) });
		await screen.findByText(/No requests yet/);
		FakeEventSource.latest().fail(true);
		expect(FakeEventSource.instances).toHaveLength(1);
		act(() => {
			vi.advanceTimersByTime(5_000);
		});
		expect(FakeEventSource.instances).toHaveLength(2);
	});

	it("pauses with the Live switch and while the page is hidden", async () => {
		renderLogPanel({ [`GET ${LOGS_PATH}`]: page([]) });
		await screen.findByText(/No requests yet/);
		const live = screen.getByRole("switch", { name: "Live" });
		await userEvent.click(live);
		expect(live).toHaveAttribute("aria-checked", "false");
		expect(byId("request-log-status")).toHaveAttribute("data-state", "paused");
		expect(FakeEventSource.open()).toHaveLength(0);
		await userEvent.click(live);
		expect(FakeEventSource.open()).toHaveLength(1);
		setVisibility("hidden");
		expect(FakeEventSource.open()).toHaveLength(0);
		setVisibility("visible");
		expect(FakeEventSource.open()).toHaveLength(1);
	});

	it("announces new requests in batches", async () => {
		renderLogPanel({ [`GET ${LOGS_PATH}`]: page([]) });
		await screen.findByText(/No requests yet/);
		const stream = FakeEventSource.latest();
		stream.open();
		for (const id of ["1", "2", "3", "4"]) stream.emit(logRow(id));
		expect(byId("request-log-announce")).toHaveTextContent("");
		stream.emit(logRow("5"));
		expect(byId("request-log-announce")).toHaveTextContent("5 new requests");
	});

	it("filters the list and the stream the same way", async () => {
		const { calls } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: (call) =>
				call.query.size === 0 ? page([logRow("a")]) : page([]),
		});
		await screen.findByText("/users/a");
		const user = userEvent.setup();
		await user.selectOptions(screen.getByLabelText("Method"), "POST");
		await user.selectOptions(screen.getByLabelText("Source"), "inbox");
		await user.selectOptions(screen.getByLabelText("Status"), "5xx");
		await user.type(screen.getByLabelText("Path contains"), "/_inbox/");
		const expected = "method=POST&status=5xx&source=inbox&path=%2F_inbox%2F";
		await waitFor(() =>
			expect(FakeEventSource.latest().url).toBe(
				`${LOGS_PATH}/stream?${expected}`,
			),
		);
		const last = calls.filter((call) => call.path === LOGS_PATH).at(-1);
		expect(last?.query.toString()).toBe(expected);
		expect(FakeEventSource.open()).toHaveLength(1);
		const empty = await waitFor(() => {
			const cell = byId("request-log-empty-filtered");
			if (!cell) throw new Error("not filtered yet");
			return cell;
		});
		expect(empty).toHaveTextContent("No requests match the filters.");
		const clear = byId("request-log-empty-clear");
		if (!(clear instanceof HTMLElement)) throw new Error("no clear button");
		await user.click(clear);
		expect(await screen.findByText("/users/a")).toBeInTheDocument();
		expect(screen.getByLabelText("Path contains")).toHaveValue("");
		expect(FakeEventSource.latest().url).toBe(`${LOGS_PATH}/stream`);
	});

	it("reports a log it cannot load and tries again", async () => {
		let fail = true;
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: () =>
				fail
					? { status: 500, body: { error: { code: "INTERNAL", message: "x" } } }
					: page([logRow("a")]),
		});
		expect(
			await screen.findByText(/Couldn't load the request log/),
		).toBeVisible();
		fail = false;
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("/users/a")).toBeInTheDocument();
	});

	it("has no serious axe violations with rows and a detail", async () => {
		const { container } = renderLogPanel({
			[`GET ${LOGS_PATH}`]: page([
				logRow("a"),
				logRow("b", { source: "callback" }),
			]),
			[`GET ${LOGS_PATH}/a`]: { body: logLine("a") },
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "/users/a" }),
		);
		await screen.findByText("Request headers", { selector: "h3" });
		expect(byId("request-log-retention")).toHaveTextContent(
			"Logs are kept for 7 days on the Free plan.",
		);
		expect(await seriousViolations(container)).toEqual([]);
	});
});
