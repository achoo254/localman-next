import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { newDraft, newHeader, parseTargetText } from "./callback-draft";
import { checkDraft, sampleBody, serverErrors } from "./callback-validation";

const { t } = createTranslator("en", en);
const TEMPLATE = '{"event":"{{event}}","record":{{record}}}';

describe("callback target text", () => {
	it("reads https URLs and tunnels", () => {
		expect(parseTargetText(" https://hooks.example.com/a?x=1 ")).toEqual({
			ok: true,
			target: { kind: "url", url: "https://hooks.example.com/a?x=1" },
		});
		expect(parseTargetText("tunnel:3000/hooks/users")).toEqual({
			ok: true,
			target: { kind: "tunnel", port: 3000, path: "/hooks/users" },
		});
		expect(parseTargetText("tunnel:8080")).toEqual({
			ok: true,
			target: { kind: "tunnel", port: 8080, path: "/" },
		});
	});

	it("names what is wrong", () => {
		expect(parseTargetText("")).toEqual({ ok: false, reason: "empty" });
		expect(parseTargetText("http://a.example.com")).toEqual({
			ok: false,
			reason: "http",
		});
		expect(parseTargetText("tunnel:70000/x")).toEqual({
			ok: false,
			reason: "port",
		});
		expect(parseTargetText("ftp://a")).toEqual({ ok: false, reason: "format" });
		expect(parseTargetText("tunnel:3000/a b")).toEqual({
			ok: false,
			reason: "format",
		});
	});
});

describe("callback checks", () => {
	it("fills variables like the server before parsing", () => {
		expect(
			sampleBody('{"n":"{{record.name}}","r":{{ record }}}', "users"),
		).toBe('{"n":"1","r":{"id":"1"}}');
	});

	it("flags a template that is not JSON once filled", () => {
		const draft = {
			...newDraft('{"record":"{{record}}"}'),
			target: "tunnel:3000/h",
		};
		const { errors, input } = checkDraft(draft, t);
		expect(input).toBeNull();
		expect(errors.body).toContain("isn't valid JSON");
	});

	it("sends an untouched hidden value back as [hidden] and drops empty rows", () => {
		const hidden = { ...newHeader(), name: "X-Secret", hidden: true };
		const draft = {
			...newDraft(TEMPLATE),
			target: "https://hooks.example.com/x",
			headers: [hidden, newHeader()],
		};
		expect(checkDraft(draft, t).input?.headers).toEqual([
			{ name: "X-Secret", value: "[hidden]" },
		]);
		const typed = { ...draft, headers: [{ ...hidden, value: "new" }] };
		expect(checkDraft(typed, t).input?.headers).toEqual([
			{ name: "X-Secret", value: "new" },
		]);
	});

	it("places API details on the callback of their index", () => {
		const a = newDraft(TEMPLATE);
		const b = newDraft(TEMPLATE);
		const error = new ApiError(400, "CALLBACK_DNS_FAILED", "No DNS", [
			{ path: "callbacks.1.target.url", message: "The host doesn't resolve." },
		]);
		expect(serverErrors(error, [a, b], t)).toEqual({
			[b.key]: { target: "The host doesn't resolve." },
		});
		const test = new ApiError(400, "CALLBACK_URL_BLOCKED", "Blocked", [
			{ path: "callback.target.url", message: "Private host." },
		]);
		expect(serverErrors(test, [], t, a)).toEqual({
			[a.key]: { target: "Private host." },
		});
		expect(serverErrors(new ApiError(500, "X", "x"), [a], t)).toBeNull();
	});
});
