import { SCRIPT_TIMEOUT_MS } from "@localman/shared/api-client";
import type {
	ScriptRunInput,
	ScriptRunResult,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ScriptWorker, createScriptHost } from "./script-host";
import type { ScriptJob } from "./script-messages";

const INPUT: ScriptRunInput = {
	phase: "pre",
	script: "lm.variables.set('a', '1')",
	request: { method: "GET", url: "https://api.test/", headers: [], body: null },
	globals: {},
	collectionVariables: {},
	environment: {},
	variables: {},
};

function resultFor(input: ScriptRunInput): ScriptRunResult {
	return {
		request: input.request,
		globals: {},
		collectionVariables: {},
		environment: {},
		variables: { a: "1" },
		tests: [],
		logs: [],
		logsTruncated: false,
		error: null,
	};
}

/** Worker that answers each job unless `silent`; records terminations. */
class FakeWorker extends EventTarget implements ScriptWorker {
	terminated = false;
	jobs: ScriptJob[] = [];
	constructor(private readonly silent: boolean) {
		super();
	}
	postMessage(job: ScriptJob): void {
		this.jobs.push(job);
		if (this.silent) return;
		queueMicrotask(() =>
			this.dispatchEvent(
				new MessageEvent("message", {
					data: { id: job.id, result: resultFor(job.input) },
				}),
			),
		);
	}
	terminate(): void {
		this.terminated = true;
	}
}

const unusedFallback = (): ScriptRunner => {
	throw new Error("fallback not expected");
};

afterEach(() => vi.useRealTimers());

describe("createScriptHost", () => {
	it("runs scripts in the worker and reuses it", async () => {
		const workers: FakeWorker[] = [];
		const host = createScriptHost({
			fallback: unusedFallback,
			createWorker: () => {
				const worker = new FakeWorker(false);
				workers.push(worker);
				return worker;
			},
		});
		expect((await host.run(INPUT)).variables).toEqual({ a: "1" });
		expect((await host.run(INPUT)).error).toBeNull();
		expect(workers).toHaveLength(1);
		expect(workers[0]?.jobs.map((job) => job.id)).toEqual([1, 2]);
	});

	it("terminates a worker past the hard deadline and starts a new one", async () => {
		vi.useFakeTimers();
		const workers: FakeWorker[] = [];
		const host = createScriptHost({
			fallback: unusedFallback,
			graceMs: 100,
			loadMs: 0,
			createWorker: () => {
				const worker = new FakeWorker(workers.length === 0);
				workers.push(worker);
				return worker;
			},
		});
		const stuck = host.run(INPUT);
		await vi.advanceTimersByTimeAsync(SCRIPT_TIMEOUT_MS + 100);
		const result = await stuck;
		expect(result.error?.code).toBe("SCRIPT_TIMEOUT");
		expect(result.variables).toEqual({});
		expect(workers[0]?.terminated).toBe(true);

		vi.useRealTimers();
		expect((await host.run(INPUT)).error).toBeNull();
		expect(workers).toHaveLength(2);
	});

	it("reports a worker that fails to load as unavailable", async () => {
		const workers: FakeWorker[] = [];
		const host = createScriptHost({
			fallback: unusedFallback,
			createWorker: () => {
				const worker = new FakeWorker(true);
				workers.push(worker);
				return worker;
			},
		});
		const run = host.run(INPUT);
		await vi.waitFor(() => expect(workers[0]?.jobs).toHaveLength(1));
		workers[0]?.dispatchEvent(new Event("error"));
		expect((await run).error?.code).toBe("SCRIPT_UNAVAILABLE");
	});

	it("uses the main-thread runner where Worker does not exist", () => {
		const fallback: ScriptRunner = { run: async (input) => resultFor(input) };
		vi.stubGlobal("Worker", undefined);
		try {
			expect(createScriptHost({ fallback: () => fallback })).toBe(fallback);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
