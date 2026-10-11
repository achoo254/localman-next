import {
	type ClientResponse,
	createRequestDraft,
} from "@localman/shared/api-client";
import type {
	ScriptRunInput,
	ScriptRunResult,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import { describe, expect, it } from "vitest";
import { finishSend, prepareSend } from "./send-steps";
import type { SendContext } from "./workbench-tab-types";

/**
 * Stands in for QuickJS: each script is `name` or `name=key:value`; it
 * logs its name and sets `lm.variables[key] = value`. `fail` errors.
 */
function fakeRunner(): ScriptRunner & { ran: string[] } {
	const ran: string[] = [];
	const run = async (input: ScriptRunInput): Promise<ScriptRunResult> => {
		const [name = "", set] = input.script.split("=");
		ran.push(`${input.phase}:${name}`);
		const [key, value] = set ? set.split(":") : [];
		const variables = { ...input.variables };
		if (key && value !== undefined) variables[key] = value;
		return {
			request: input.request,
			environment: { ...input.environment },
			variables,
			tests: [{ name, passed: true, error: null }],
			logs: [{ level: "log", message: name }],
			logsTruncated: false,
			error: name === "fail" ? { code: "SCRIPT_ERROR", message: "boom" } : null,
		};
	};
	return { run, ran };
}

const RESPONSE: ClientResponse = {
	status: 200,
	statusText: "OK",
	headers: [],
	body: "",
	bodyEncoding: "utf8",
	size: 0,
	timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
	finalUrl: "https://shop.test/items/7",
	truncated: false,
};

const signal = new AbortController().signal;
const files = new Map<string, File>();

const CONTEXT: SendContext = {
	inheritedAuth: { type: "bearer", token: "{{token}}" },
	preScripts: ["collection", "folder", "request=id:7"],
	postScripts: ["collection", "request"],
	variables: [
		{ key: "baseUrl", value: "https://shop.test" },
		{ key: "id", value: "1" },
		{ key: "token", value: "s3cret", secret: true },
	],
};

describe("send with a collection context", () => {
	it("runs scripts collection first, takes inherited auth and collection variables", async () => {
		const runner = fakeRunner();
		const draft = createRequestDraft({
			url: "{{baseUrl}}/items/{{id}}",
			auth: { type: "inherit" },
			scripts: { pre: "ignored: the context holds it", post: "" },
		});
		const ready = await prepareSend(
			{ draft, files, signal, context: CONTEXT },
			runner,
		);
		if (!ready.ok) throw new Error("not ready");
		expect(runner.ran).toEqual(["pre:collection", "pre:folder", "pre:request"]);
		// `lm.variables` (id=7) wins over the collection's id=1.
		expect(ready.prepared.url).toBe("https://shop.test/items/7");
		expect(ready.prepared.headers).toContainEqual({
			name: "Authorization",
			value: "Bearer s3cret",
		});
		expect(ready.prepared.secretsUsed).toEqual(["token"]);
		expect(ready.preScript?.logs.map((l) => l.message)).toEqual([
			"collection",
			"folder",
			"request",
		]);

		const done = await finishSend(
			ready,
			{ response: RESPONSE, route: "proxy" },
			runner,
		);
		expect(runner.ran.slice(3)).toEqual(["post:collection", "post:request"]);
		expect(done.kind === "done" && done.result.postScript?.tests).toHaveLength(
			2,
		);
	});

	it("stops at the first failing pre-request script and does not send", async () => {
		const runner = fakeRunner();
		const draft = createRequestDraft({ url: "https://a.test" });
		const context = {
			...CONTEXT,
			preScripts: ["collection", "fail", "request"],
		};
		const ready = await prepareSend({ draft, files, signal, context }, runner);
		expect(ready.ok).toBe(false);
		expect(runner.ran).toEqual(["pre:collection", "pre:fail"]);
	});

	it("keeps a loose tab as before: its own scripts, no parent auth", async () => {
		const runner = fakeRunner();
		const draft = createRequestDraft({
			url: "https://a.test/{{id}}",
			auth: { type: "inherit" },
			scripts: { pre: "own=id:3", post: "after" },
		});
		const ready = await prepareSend({ draft, files, signal }, runner);
		if (!ready.ok) throw new Error("not ready");
		expect(runner.ran).toEqual(["pre:own"]);
		expect(ready.prepared.url).toBe("https://a.test/3");
		expect(ready.prepared.headers.some((h) => h.name === "Authorization")).toBe(
			false,
		);
		expect(ready.postScripts).toEqual(["after"]);
	});
});
