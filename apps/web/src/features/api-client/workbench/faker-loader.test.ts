import { createRequestDraft } from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakerForSend, needsFaker } from "./faker-loader";
import { prepareSend } from "./send-steps";

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

const noScripts: ScriptRunner = {
	run: async () => {
		throw new Error("no script should run");
	},
};

describe("needsFaker", () => {
	it("is true only for `$random…` names that Faker fills", () => {
		const draft = (url: string) => createRequestDraft({ url });
		expect(needsFaker(draft("https://x.test/{{$randomFirstName}}"))).toBe(true);
		expect(needsFaker(draft("https://x.test/{{ $randomIP }}"))).toBe(true);
		expect(needsFaker(draft("https://x.test/{{$guid}}/{{$randomInt}}"))).toBe(
			false,
		);
		expect(needsFaker(draft("{{baseUrl}}/{{$nope}}"))).toBe(false);
	});
});

describe("fakerForSend", () => {
	afterEach(() => {
		vi.doUnmock("@localman/shared/faker-methods");
		vi.resetModules();
	});

	it("loads no runner for a request without Faker names", async () => {
		const draft = createRequestDraft({ url: "https://x.test/{{$guid}}" });
		expect(await fakerForSend(draft)).toEqual({ ok: true });
	});

	it("runs whitelisted Faker methods once loaded", async () => {
		const draft = createRequestDraft({ url: "https://x.test/{{$randomIP}}" });
		const result = await fakerForSend(draft);
		if (!result.ok || !result.runFaker) throw new Error("no runner");
		expect(result.runFaker("internet.ipv4")).toMatch(IPV4);
	});

	it("reports a chunk that cannot load, then tries again", async () => {
		vi.resetModules();
		vi.doMock("@localman/shared/faker-methods", () => {
			throw new Error("chunk fetch failed");
		});
		const loader = await import("./faker-loader");
		const draft = createRequestDraft({ url: "https://x.test/{{$randomIP}}" });
		expect(await loader.fakerForSend(draft)).toEqual({ ok: false });
		vi.doUnmock("@localman/shared/faker-methods");
		const again = await loader.fakerForSend(draft);
		expect(again.ok).toBe(true);
	});
});

describe("prepareSend with dynamic variables", () => {
	it("fills `{{$random…}}` from Faker before the network", async () => {
		const draft = createRequestDraft({
			url: "https://{{$randomIP}}/users",
			scripts: { pre: "", post: "" },
		});
		const signal = new AbortController().signal;
		const outcome = await prepareSend(
			{ draft, files: new Map(), signal },
			noScripts,
		);
		if (!outcome.ok) throw new Error(JSON.stringify(outcome.settled));
		const host = new URL(outcome.prepared.url).hostname;
		expect(host).toMatch(IPV4);
	});
});
