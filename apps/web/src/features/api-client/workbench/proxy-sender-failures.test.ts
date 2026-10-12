import {
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../../test/mock-fetch";
import { createProxySender } from "./proxy-sender";

const signal = () => new AbortController().signal;
/** Requests here carry no script, so the runner must never run. */
const fakeRunner = (): ScriptRunner => ({
	run: () => Promise.reject(new Error("no script expected")),
});

afterEach(() => vi.unstubAllGlobals());

describe("createProxySender failures", () => {
	it("stops before the network on a pre-script error or an invalid request", async () => {
		const { calls } = mockFetch({});
		const failing: ScriptRunner = {
			run: async (input) => ({
				request: input.request,
				globals: {},
				collectionVariables: {},
				environment: {},
				variables: {},
				tests: [],
				logs: [{ level: "log", message: "before" }],
				logsTruncated: false,
				error: { code: "SCRIPT_TIMEOUT", message: "deadline", line: 3 },
			}),
		};
		const draft = createRequestDraft({
			url: "https://a.test",
			scripts: { pre: "while(true){}", post: "" },
		});
		const stopped = await createProxySender(failing)({
			draft,
			files: new Map(),
			signal: signal(),
		});
		expect(stopped).toMatchObject({
			kind: "failed",
			failure: {
				code: "SCRIPT_TIMEOUT",
				message:
					"Not sent: the pre-request script stopped. The script ran for too long and was stopped. (line 3)",
				preScript: { logs: [{ message: "before" }] },
			},
		});
		const invalid = await createProxySender(failing)({
			draft: createRequestDraft({ url: "{{base}}/x" }),
			files: new Map(),
			signal: signal(),
		});
		expect(invalid).toMatchObject({
			kind: "failed",
			failure: { code: "INVALID_URL" },
		});
		const missing = await createProxySender(failing)({
			draft: createRequestDraft({
				method: "POST",
				url: "https://a.test",
				body: {
					...emptyRequestBody(),
					type: "binary",
					binary: { fileId: "gone", name: "x.png", contentType: "", size: 1 },
				},
			}),
			files: new Map(),
			signal: signal(),
		});
		expect(missing).toMatchObject({
			kind: "failed",
			failure: { code: "FILE_MISSING" },
		});
		expect(calls).toEqual([]);
	});

	it("reports proxy errors with their code and status, and aborts as cancelled", async () => {
		mockFetch({
			"POST /api/v1/proxy": {
				status: 429,
				body: {
					error: { code: "MONTHLY_QUOTA_EXCEEDED", message: "Quota reached." },
				},
			},
		});
		const draft = createRequestDraft({ url: "https://a.test" });
		const send = createProxySender(fakeRunner());
		expect(
			await send({ draft, files: new Map(), signal: signal() }),
		).toMatchObject({
			kind: "failed",
			failure: {
				code: "MONTHLY_QUOTA_EXCEEDED",
				status: 429,
				message: "Quota reached.",
			},
		});
		const controller = new AbortController();
		controller.abort();
		expect(
			await send({ draft, files: new Map(), signal: controller.signal }),
		).toEqual({ kind: "cancelled" });
	});
});
