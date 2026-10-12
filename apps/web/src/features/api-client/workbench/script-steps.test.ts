import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	applyScriptRequest,
	createLazyScriptRunner,
	toScriptRequest,
} from "./script-steps";

const ids = () => {
	let n = 0;
	return () => `n${++n}`;
};

describe("script steps", () => {
	it("loads QuickJS on demand and lets a pre-request script change the request", async () => {
		const draft = createRequestDraft({
			url: "https://a.test/users",
			headers: [{ id: "h1", key: "Accept", value: "*/*", enabled: true }],
		});
		const result = await createLazyScriptRunner().run({
			phase: "pre",
			script: [
				'lm.variables.set("id", "7");',
				'lm.request.setHeader("X-Trace", "{{id}}");',
				'lm.request.url = lm.request.url + "?page=2";',
			].join("\n"),
			request: toScriptRequest(draft),
			globals: {},
			collectionVariables: {},
			environment: {},
			variables: {},
		});
		expect(result.error).toBeNull();
		expect(result.variables).toEqual({ id: "7" });
		const sent = applyScriptRequest(draft, result.request, ids());
		expect(sent.url).toBe("https://a.test/users?page=2");
		expect(sent.params).toEqual([
			{ id: "n1", key: "page", value: "2", enabled: true },
		]);
		expect(sent.headers.map((h) => [h.key, h.value])).toEqual([
			["Accept", "*/*"],
			["X-Trace", "{{id}}"],
		]);
	}, 20_000);

	it("leaves untouched parts of the draft as they were", () => {
		const draft = createRequestDraft({ url: "https://a.test" });
		const same = applyScriptRequest(draft, toScriptRequest(draft), ids());
		expect(same.headers).toBe(draft.headers);
		expect(same.params).toBe(draft.params);
		expect(same.body).toBe(draft.body);
	});
});
