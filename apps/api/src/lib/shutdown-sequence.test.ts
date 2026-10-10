import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import {
	type ShutdownParts,
	runShutdownSteps,
	shutdownSteps,
} from "./shutdown-sequence.js";

/** Parts that record when they run; `slowServers` never finish closing. */
function recordingParts(slowServers = false) {
	const calls: string[] = [];
	const step = (name: string) => async () => {
		calls.push(name);
	};
	const parts: ShutdownParts = {
		outboundQueue: { stop: step("queue") },
		closeStreams: step("streams"),
		usageMeter: { stop: step("usage") },
		requestLog: { stop: step("log") },
		closeServers: async () => {
			calls.push("servers");
			if (slowServers) await new Promise(() => undefined);
		},
		drain: step("background"),
		disconnect: step("mongo"),
	};
	return { calls, parts };
}

const quiet = () => undefined;

describe("shutdown sequence", () => {
	it("stops new work, then saves counts and log, then closes servers and Mongo", async () => {
		const { calls, parts } = recordingParts();
		const outcome = await runShutdownSteps(shutdownSteps(parts), 1_000, quiet);
		expect(outcome).toEqual({ finished: true, failed: [], cutAt: null });
		expect(calls).toEqual([
			"queue",
			"streams",
			"usage",
			"log",
			"servers",
			"queue",
			"usage",
			"log",
			"background",
			"mongo",
		]);
	});

	it("ends within its budget when a server never closes, counts already saved", async () => {
		const { calls, parts } = recordingParts(true);
		const started = Date.now();
		const outcome = await runShutdownSteps(shutdownSteps(parts), 200, quiet);
		expect(Date.now() - started).toBeLessThan(1_000);
		expect(outcome).toMatchObject({ finished: false, cutAt: "servers" });
		expect(calls).toEqual(["queue", "streams", "usage", "log", "servers"]);
	});

	it("runs the next steps after one fails", async () => {
		const errors: string[] = [];
		const outcome = await runShutdownSteps(
			[
				{ name: "a", run: () => Promise.reject(new Error("boom")) },
				{ name: "b", run: () => sleep(5) },
			],
			1_000,
			(step) => errors.push(step),
		);
		expect(outcome).toEqual({ finished: true, failed: ["a"], cutAt: null });
		expect(errors).toEqual(["a"]);
	});
});
