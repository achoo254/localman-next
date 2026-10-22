import { describe, expect, it } from "vitest";
import { takeEvents } from "./native-event-stream";

function collect(text: string): { events: [string, string][]; tail: string } {
	const events: [string, string][] = [];
	const tail = takeEvents(text, (event, data) => events.push([event, data]));
	return { events, tail };
}

describe("takeEvents", () => {
	it("emits complete events and keeps the unfinished one", () => {
		const { events, tail } = collect(
			'event: log\ndata: {"a":1}\n\nevent: log\ndata: {"b"',
		);
		expect(events).toEqual([["log", '{"a":1}']]);
		expect(tail).toBe('event: log\ndata: {"b"');
	});

	it("joins data lines, skips comments and keepalives, reads CRLF", () => {
		const { events } = collect(
			": ping\r\n\r\ndata: one\r\ndata: two\r\n\r\nretry: 5000\n\n",
		);
		expect(events).toEqual([["message", "one\ntwo"]]);
	});

	it("continues an event split across chunks", () => {
		const first = collect("event: log\nda");
		const second = collect(`${first.tail}ta: x\n\n`);
		expect(first.events).toEqual([]);
		expect(second.events).toEqual([["log", "x"]]);
	});
});
