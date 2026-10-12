import { describe, expect, it, vi } from "vitest";
import { MAX_SCRIPT_LENGTH } from "../limits.js";
import { createScriptRunner } from "./run-script.js";
import { baseRequest, runPost, runPre } from "./script-test-utils.js";
import {
	MAX_SCRIPT_LOG_ENTRIES,
	MAX_SCRIPT_LOG_LENGTH,
} from "./script-types.js";

const loadVariant = async () =>
	(await import("@jitl/quickjs-wasmfile-release-sync")).default;

describe("createScriptRunner loading", () => {
	it("does not load QuickJS until a script has code, then loads once", async () => {
		const loader = vi.fn(loadVariant);
		const runner = createScriptRunner(loader);
		const input = {
			phase: "pre" as const,
			request: baseRequest,
			globals: {},
			collectionVariables: {},
			environment: {},
			variables: {},
		};
		const empty = await runner.run({ ...input, script: "  \n " });
		expect(empty.error).toBeNull();
		expect(loader).not.toHaveBeenCalled();
		await runner.run({ ...input, script: "1" });
		await runner.run({ ...input, script: "2" });
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("reports a module that fails to load and retries on the next run", async () => {
		const loader = vi
			.fn(loadVariant)
			.mockRejectedValueOnce(new Error("CSP blocked wasm"));
		const runner = createScriptRunner(loader);
		const input = {
			phase: "pre" as const,
			script: "lm.environment.set('a', 1)",
			request: baseRequest,
			globals: {},
			collectionVariables: {},
			environment: {},
			variables: {},
		};
		const first = await runner.run(input);
		expect(first.error).toEqual({
			code: "SCRIPT_UNAVAILABLE",
			message: "CSP blocked wasm",
		});
		const second = await runner.run(input);
		expect(second.error).toBeNull();
		expect(second.environment).toEqual({ a: "1" });
	});

	it("rejects a script over the length cap without running it", async () => {
		const result = await runPre("x".repeat(MAX_SCRIPT_LENGTH + 1));
		expect(result.error?.code).toBe("SCRIPT_TOO_LONG");
	});
});

describe("script limits", () => {
	it("interrupts an endless loop at the deadline and keeps earlier logs", async () => {
		const result = await runPost(
			"console.log('before'); lm.test('spins', () => { while (true) {} });",
		);
		expect(result.error?.code).toBe("SCRIPT_TIMEOUT");
		expect(result.logs).toEqual([{ level: "log", message: "before" }]);
		expect(result.tests).toEqual([
			{ name: "spins", passed: false, error: "Error: the test did not finish" },
		]);
	}, 15_000);

	it("stops a script that allocates past the memory cap", async () => {
		const result = await runPre(
			// 1 MiB buffers reach the cap in milliseconds (small arrays took
			// seconds), far from the time limit even on a slow machine.
			"const keep = []; while (true) keep.push(new ArrayBuffer(1 << 20));",
		);
		expect(result.error?.code).toBe("SCRIPT_MEMORY_LIMIT");
	});

	it.each([
		["recursion", "function f() { return f() + 1; } f();"],
		["deep JSON", "JSON.parse('['.repeat(200000));"],
		[
			"deep stringify",
			"let o = {}; let c = o; for (let i = 0; i < 200000; i++) { c.a = {}; c = c.a; } JSON.stringify(o);",
		],
	])("stops %s at the stack cap and stays usable", async (_, script) => {
		const result = await runPre(script);
		expect(result.error?.code).toBe("SCRIPT_STACK_OVERFLOW");
		const next = await runPre("lm.environment.set('after', 'ok')");
		expect(next.error).toBeNull();
		expect(next.environment.after).toBe("ok");
	});

	it("caps the number and length of console lines", async () => {
		const result = await runPre(
			"for (let i = 0; i < 1000; i++) console.info(i); console.warn('x'.repeat(10));",
		);
		expect(result.logs).toHaveLength(MAX_SCRIPT_LOG_ENTRIES);
		expect(result.logsTruncated).toBe(true);
		const long = await runPre("console.error('x'.repeat(100000), 1)");
		expect(long.logs[0].message).toHaveLength(MAX_SCRIPT_LOG_LENGTH);
		expect(long.logs[0].level).toBe("error");
		expect(long.logsTruncated).toBe(true);
	});

	it("formats console arguments like a terminal", async () => {
		const result = await runPre("console.log('n', 1, { a: [1] }, null)");
		expect(result.logs).toEqual([
			{ level: "log", message: 'n 1 {"a":[1]} null' },
		]);
		expect(result.logsTruncated).toBe(false);
	});
});

describe("sandbox isolation", () => {
	it("exposes no network, timers, module loader or host objects", async () => {
		const names = [
			"fetch",
			"XMLHttpRequest",
			"WebSocket",
			"process",
			"require",
			"module",
			"importScripts",
			"document",
			"window",
			"setTimeout",
			"Buffer",
		];
		const result = await runPre(
			`const names = ${JSON.stringify(names)};
			const seen = names.map((n) => typeof globalThis[n]);
			const viaFunction = Function("return typeof process + typeof fetch")();
			lm.environment.set("seen", seen.join(","));
			lm.environment.set("viaFunction", viaFunction);`,
		);
		expect(result.error).toBeNull();
		expect(result.environment.seen).toBe(
			names.map(() => "undefined").join(","),
		);
		expect(result.environment.viaFunction).toBe("undefinedundefined");
	});

	it("cannot load host modules", async () => {
		const result = await runPre(
			"import('fs').then(() => lm.environment.set('fs', 'loaded'), (e) => lm.environment.set('fs', String(e)))",
		);
		expect(result.environment.fs).toContain("could not load module");
	});

	it("cannot replace lm or console for later code", async () => {
		const result = await runPre(
			"lm = null; console = null; lm.environment.set('still', 'here')",
		);
		expect(result.error).toBeNull();
		expect(result.environment.still).toBe("here");
	});
});

describe("script errors", () => {
	it("reports syntax errors with their line", async () => {
		const result = await runPre("const a = 1;\nconst b = ;");
		expect(result.error).toMatchObject({ code: "SCRIPT_ERROR", line: 2 });
		expect(result.error?.message).toMatch(/^SyntaxError/);
	});

	it("reports thrown errors with their line and changes nothing", async () => {
		const result = await runPre(
			"lm.environment.set('half', 'done');\nconsole.log('ran');\nthrow new TypeError('boom');",
		);
		expect(result.error).toEqual({
			code: "SCRIPT_ERROR",
			message: "TypeError: boom",
			line: 3,
		});
		expect(result.environment).toEqual({ baseUrl: "https://api.example.com" });
		expect(result.request).toBe(baseRequest);
		expect(result.logs).toEqual([{ level: "log", message: "ran" }]);
	});

	it("reports thrown non-errors", async () => {
		const result = await runPost("throw { reason: 'nope' }");
		expect(result.error).toEqual({
			code: "SCRIPT_ERROR",
			message: 'Uncaught {"reason":"nope"}',
		});
	});
});
