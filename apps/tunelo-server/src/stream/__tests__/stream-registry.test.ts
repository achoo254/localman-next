import { describe, expect, test } from "vitest";
import { StreamRegistry, type StreamSink } from "../stream-registry.js";

interface Calls {
	starts: number;
	data: string[];
	ends: number;
	errors: string[];
}

function spySink(): { sink: StreamSink; calls: Calls } {
	const calls: Calls = { starts: 0, data: [], ends: 0, errors: [] };
	const sink: StreamSink = {
		onStart: () => {
			calls.starts++;
		},
		onData: (chunk) => {
			calls.data.push(chunk.toString());
		},
		onEnd: () => {
			calls.ends++;
		},
		onError: (err) => {
			calls.errors.push(err.message);
		},
	};
	return { sink, calls };
}

describe("StreamRegistry", () => {
	test("normal lifecycle: start → data → end, then entry is gone", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.push("c1", {
			type: "stream-start",
			id: "r1",
			status: 200,
			headers: {},
		});
		reg.push("c1", {
			type: "stream-data",
			id: "r1",
			data: Buffer.from("hello").toString("base64"),
		});
		reg.push("c1", { type: "stream-end", id: "r1" });

		expect(calls.starts).toBe(1);
		expect(calls.data).toEqual(["hello"]);
		expect(calls.ends).toBe(1);
		expect(reg.has("r1")).toBe(false);
	});

	test("duplicate stream-start is ignored (would double writeHead)", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.push("c1", {
			type: "stream-start",
			id: "r1",
			status: 200,
			headers: {},
		});
		reg.push("c1", {
			type: "stream-start",
			id: "r1",
			status: 500,
			headers: {},
		});
		expect(calls.starts).toBe(1);
	});

	test("stream-data before start is dropped", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.push("c1", {
			type: "stream-data",
			id: "r1",
			data: Buffer.from("x").toString("base64"),
		});
		expect(calls.data).toEqual([]);
	});

	test("legacy response maps to start → data → end", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.pushLegacyResponse("c1", {
			type: "response",
			id: "r1",
			status: 200,
			headers: {},
			body: Buffer.from("legacy").toString("base64"),
		});
		expect(calls.starts).toBe(1);
		expect(calls.data).toEqual(["legacy"]);
		expect(calls.ends).toBe(1);
	});

	test("cleanupByConnection fails in-flight streams for that connection only", () => {
		const reg = new StreamRegistry();
		const a = spySink();
		const b = spySink();
		reg.register("r1", "conn-a", a.sink);
		reg.register("r2", "conn-b", b.sink);
		reg.cleanupByConnection("conn-a");
		expect(a.calls.errors.length).toBe(1);
		expect(b.calls.errors.length).toBe(0);
		expect(reg.has("r1")).toBe(false);
		expect(reg.has("r2")).toBe(true);
	});

	test("frames for an unknown/closed id are ignored", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.push("c1", {
			type: "stream-start",
			id: "r1",
			status: 200,
			headers: {},
		});
		reg.push("c1", { type: "stream-end", id: "r1" });
		// Late frame after the stream finished — must be a no-op.
		reg.push("c1", {
			type: "stream-data",
			id: "r1",
			data: Buffer.from("late").toString("base64"),
		});
		expect(calls.data).toEqual([]);
	});

	test("frames from another connection are ignored", () => {
		const reg = new StreamRegistry();
		const { sink, calls } = spySink();
		reg.register("r1", "c1", sink);
		reg.push("c2", {
			type: "stream-start",
			id: "r1",
			status: 200,
			headers: {},
		});
		reg.pushLegacyResponse("c2", {
			type: "response",
			id: "r1",
			status: 200,
			headers: {},
			body: "",
		});
		expect(calls.starts).toBe(0);
		expect(reg.has("r1")).toBe(true);
	});
});
