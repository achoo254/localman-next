import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { detail, folder, request } from "./collections-test-utils";
import { folderOptions } from "./folder-options";
import { parseMarkdown } from "./markdown-view";
import { sendContextOf } from "./use-send-context";

describe("parseMarkdown", () => {
	it("reads headings, paragraphs, lists and fenced code", () => {
		const blocks = parseMarkdown(
			"# Title\nfirst line\nsecond line\n\n- a\n- b\n1. one\n```\n<b>x</b>\n```",
		);
		expect(blocks).toEqual([
			{ kind: "heading", level: 1, text: "Title" },
			{ kind: "paragraph", text: "first line second line" },
			{ kind: "list", ordered: false, items: ["a", "b"] },
			{ kind: "list", ordered: true, items: ["one"] },
			{ kind: "code", text: "<b>x</b>" },
		]);
	});
});

describe("folderOptions", () => {
	it("lists folders in tree order with their path", () => {
		const shop = detail("c1", [
			folder("f2", null, "a1", "Orders"),
			folder("f1", null, "a0", "Users"),
			folder("f3", "f1", "a0", "Admin"),
			request("r1", "f1", "a1"),
		]);
		expect(folderOptions(shop)).toEqual([
			{ id: "f1", path: "Users" },
			{ id: "f3", path: "Users / Admin" },
			{ id: "f2", path: "Orders" },
		]);
	});
});

describe("sendContextOf", () => {
	const shop = detail(
		"c1",
		[
			{ ...folder("f1", null, "a0"), scripts: { pre: "folder()", post: "" } },
			request("r1", "f1", "a0"),
		],
		{
			auth: { type: "basic", username: "u", password: "p" },
			scripts: { pre: "collection()", post: "after()" },
			variables: [{ key: "baseUrl", value: "https://a.test" }],
		},
	);

	it("takes the tab's unsaved scripts after the collection's and folders'", () => {
		const draft = createRequestDraft({ scripts: { pre: "mine()", post: "" } });
		const context = sendContextOf(shop, {
			source: { collectionId: "c1", nodeId: "r1" },
			draft,
		});
		expect(context).toEqual({
			inheritedAuth: { type: "basic", username: "u", password: "p" },
			preScripts: ["collection()", "folder()", "mine()"],
			postScripts: ["after()"],
			variables: [{ key: "baseUrl", value: "https://a.test" }],
		});
	});

	it("is null for a loose tab or a node that is gone", () => {
		const draft = createRequestDraft();
		expect(sendContextOf(shop, { source: null, draft })).toBeNull();
		const gone = { collectionId: "c1", nodeId: "nope" };
		expect(sendContextOf(shop, { source: gone, draft })).toBeNull();
	});
});
