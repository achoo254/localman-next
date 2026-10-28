import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en } from "./i18n/messages/en/dictionary";
import { applyPageHead, renderPrerenderedFiles } from "./prerender";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(resolve(here, "../index.html"), "utf8");

function fileNamed(files: Array<{ file: string; html: string }>, name: string) {
	const found = files.find((entry) => entry.file === name);
	if (!found) throw new Error(`no ${name}`);
	return found.html.replace(/\s+/g, " ");
}

describe("prerendered files", () => {
	it("writes only the landing, marked with its path", async () => {
		const files = await renderPrerenderedFiles(template);
		expect(files.map((entry) => entry.file)).toEqual(["index.html"]);
		const landing = fileNamed(files, "index.html");
		expect(landing).toContain('<div id="app" data-prerendered="/">');
		expect(landing).toContain('data-id="hero"');
		expect(landing).toContain(`<title>${en.landing.meta.titleMock}</title>`);
		expect(landing).not.toMatch(/pricing|Free plan/i);
	});

	it("escapes the head text and refuses a template without the tags", () => {
		const head = { title: 'A <b> & "c"', description: "d" };
		expect(applyPageHead(template, head)).toContain(
			"<title>A &lt;b&gt; &amp; &quot;c&quot;</title>",
		);
		expect(() => applyPageHead("<html></html>", head)).toThrow(/title/);
	});
});
