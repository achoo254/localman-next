import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, stubEventSource } from "./fake-event-source";
import {
	LOGS_PATH,
	logLine,
	logRow,
	renderLogPanel,
} from "./request-log-test-utils";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const AT = "2026-10-10T03:04:05.000Z";

const INBOX = {
	path: "/_inbox/stripe",
	method: "POST",
	source: "inbox",
	inbox: "stripe",
	target: "tunnel:3000/hooks",
	attempts: [
		{ at: AT, status: 503, ms: 40 },
		{ at: "2026-10-10T03:04:06.000Z", status: 200, ms: 52 },
	],
};
const CALLBACK = {
	path: "/hooks/users",
	method: "POST",
	source: "callback",
	event: "create",
	target: "https://hooks.example.com/users",
	attempts: [
		{ at: AT, error: "No mapping for localhost:3000", ms: 3 },
		{ at: AT, error: "quota_exceeded", ms: 0 },
	],
};

async function openDetail(path: string): Promise<HTMLElement> {
	await userEvent.click(await screen.findByRole("button", { name: path }));
	return waitFor(() => {
		const detail = byId("request-log-detail");
		if (!(detail instanceof HTMLElement)) throw new Error("no detail");
		return detail;
	});
}

describe("request log, inbox and callback rows", () => {
	beforeEach(() => stubEventSource());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("names the inbox, its forward target and each attempt", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: {
				body: { items: [logRow("i", INBOX)], nextCursor: null },
			},
			[`GET ${LOGS_PATH}/i`]: { body: logLine("i", INBOX) },
		});
		const detail = await openDetail("/_inbox/stripe");
		expect(detail).toHaveTextContent("Inbox · stripe");
		expect(byId("request-log-detail-inbox")).toHaveTextContent(
			"Inbox stripe, forwarded to tunnel:3000/hooks.",
		);
		expect(
			screen.getByRole("list", { name: "Delivery attempts, up to 3" }),
		).toBeInTheDocument();
		expect(byId("request-log-detail-attempts-1")).toHaveTextContent(
			"Attempt 1/3503",
		);
		expect(byId("request-log-detail-attempts-2")).toHaveTextContent("200");
	});

	it("says where a callback went and why an attempt failed, without Replay", async () => {
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: {
				body: { items: [logRow("c", CALLBACK)], nextCursor: null },
			},
			[`GET ${LOGS_PATH}/c`]: { body: logLine("c", CALLBACK) },
		});
		const detail = await openDetail("/hooks/users");
		expect(detail).toHaveTextContent("Callback · create");
		expect(byId("request-log-detail-callback")).toHaveTextContent(
			"Callback create sent to https://hooks.example.com/users.",
		);
		expect(byId("request-log-detail-attempts-1")).toHaveTextContent(
			"No mapping for localhost:3000",
		);
		// A known delivery code is said in words.
		expect(byId("request-log-detail-attempts-2")).toHaveTextContent(
			"Monthly mock request quota used up; not sent",
		);
		expect(byId("request-log-replay")).toBeNull();
	});

	it("updates a streamed row in place when its forward attempts arrive", async () => {
		const { attempts, ...caught } = INBOX;
		renderLogPanel({
			[`GET ${LOGS_PATH}`]: { body: { items: [], nextCursor: null } },
			[`GET ${LOGS_PATH}/i`]: { body: logLine("i", caught) },
		});
		await screen.findByText(/No requests yet/);
		const stream = FakeEventSource.latest();
		stream.open();
		stream.emit(logRow("i", caught));
		await openDetail("/_inbox/stripe");
		expect(byId("request-log-detail-attempts")).toBeNull();

		stream.emit(logRow("i", { ...caught, attempts }));
		const rows = document.querySelectorAll('[data-id="request-log-row"]');
		expect(rows).toHaveLength(1);
		expect(byId("request-log-detail-attempts-2")).toHaveTextContent("200");
		// One request, announced once.
		for (const id of ["a", "b", "c"]) stream.emit(logRow(id));
		expect(byId("request-log-announce")).toHaveTextContent("");
		stream.emit(logRow("d"));
		expect(byId("request-log-announce")).toHaveTextContent("5 new requests");
	});
});
