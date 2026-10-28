// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	LEGACY_THEME_KEY,
	THEME_BOOTSTRAP_SCRIPT,
} from "../lib/shared-preferences";
import {
	THEME_BOOTSTRAP_MARKER,
	injectThemeBootstrap,
} from "./theme-bootstrap";

/*
 * The inline theme script of index.html (the shared script of
 * @achoo254/app-shell) runs only if the CSP names its hash. deploy.sh puts
 * the hashes of the built HTML into the nginx template
 * (infra/localman/csp-hashes.mjs), so a new package version needs no hand
 * edit; these tests keep that chain whole.
 */
const fromRoot = (path: string): string =>
	fileURLToPath(new URL(`../../../../${path}`, import.meta.url));

const INDEX_HTML = readFileSync(
	fileURLToPath(new URL("../../index.html", import.meta.url)),
	"utf8",
);

const sha256 = (text: string): string =>
	`'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

describe("theme bootstrap script", () => {
	it("takes the place of the one marker in the head of index.html", () => {
		const head = INDEX_HTML.slice(0, INDEX_HTML.indexOf("</head>"));
		expect(head.split(THEME_BOOTSTRAP_MARKER)).toHaveLength(2);
		// No hand-written theme script is left in the head.
		expect(head).not.toContain("<script>");
		const html = injectThemeBootstrap(INDEX_HTML);
		expect(html).toContain(`<script>${THEME_BOOTSTRAP_SCRIPT}</script>`);
		expect(html).not.toContain(THEME_BOOTSTRAP_MARKER);
	});

	it("refuses a page without exactly one marker", () => {
		expect(() => injectThemeBootstrap("<head></head>")).toThrow(/found 0/);
		const twice = `${THEME_BOOTSTRAP_MARKER}${THEME_BOOTSTRAP_MARKER}`;
		expect(() => injectThemeBootstrap(twice)).toThrow(/found 2/);
	});

	it("keeps the theme picked before the shared cookie", () => {
		expect(THEME_BOOTSTRAP_SCRIPT).toContain(`"${LEGACY_THEME_KEY}"`);
		expect(THEME_BOOTSTRAP_SCRIPT).toContain("hd_theme");
	});

	it("is allowed by the CSP hashes deploy.sh computes from the built HTML", () => {
		const dir = mkdtempSync(join(tmpdir(), "localman-csp-"));
		try {
			const file = join(dir, "index.html");
			writeFileSync(file, injectThemeBootstrap(INDEX_HTML));
			const sources = execFileSync(
				process.execPath,
				[fromRoot("infra/localman/csp-hashes.mjs"), file],
				{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
			);
			expect(sources.trim().split(" ")).toContain(
				sha256(THEME_BOOTSTRAP_SCRIPT),
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("goes into the script-src of the nginx template, next to Web Analytics", () => {
		const conf = readFileSync(
			fromRoot("infra/localman/nginx/localman.hoandat.com.conf"),
			"utf8",
		);
		const scriptSrc =
			/Content-Security-Policy "[^"]*?script-src ([^;]*);/.exec(conf)?.[1] ??
			"";
		expect(scriptSrc).toContain("__CSP_SCRIPT_HASHES__");
		expect(scriptSrc).toContain("https://static.cloudflareinsights.com");
	});
});
