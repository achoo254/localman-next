import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { BRAND_MARK_PATH, OG_IMAGE_PATH } from "../layout.js";
import { CONTENT_SECURITY_POLICY } from "../web-console.js";
import { WebSessionModel } from "../web-session-model.js";
import {
	RELAY_FALLBACK,
	type WebHarness,
	startWebHarness,
} from "./web-harness.js";

useTestDatabase("web-page-headers");

let harness: WebHarness;
let session: string;

beforeAll(async () => {
	harness = await startWebHarness();
	session = await harness.signIn();
});

afterAll(() => harness.close());

function page(cookie?: string) {
	return harness.request("/", cookie ? { cookie } : {});
}

describe("headers and assets", () => {
	test("CSP, no script, no inline style on every page", async () => {
		for (const res of [await page(), await page(session)]) {
			expect(res.headers["content-security-policy"]).toBe(
				CONTENT_SECURITY_POLICY,
			);
			expect(res.headers["x-content-type-options"]).toBe("nosniff");
			expect(res.headers["cache-control"]).toBe("no-store");
			expect(res.body).not.toMatch(/<script|<style| style=|\son\w+=/i);
		}
	});

	test("serves tokens.css verbatim from packages/design-tokens", async () => {
		const res = await harness.request("/assets/css/tokens.css");
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/text\/css/);
		const source = fileURLToPath(
			new URL(
				"../../../../../packages/design-tokens/tokens.css",
				import.meta.url,
			),
		);
		expect(res.body).toBe(readFileSync(source, "utf8"));
		expect((await harness.request("/assets/css/missing.css")).status).toBe(404);
	});

	test("serves the brand mark the layout shows", async () => {
		expect((await page()).body).toContain(`src="${BRAND_MARK_PATH}"`);
		const res = await harness.request(BRAND_MARK_PATH);
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toBe("image/webp");
	});

	test("link previews show the share image, served from static/img", async () => {
		const body = (await page()).body;
		expect(body).toContain(
			`<meta property="og:image" content="https://tunnel.hoandat.com${OG_IMAGE_PATH}">`,
		);
		expect(body).toContain(
			'<meta name="twitter:card" content="summary_large_image">',
		);
		const res = await harness.request(OG_IMAGE_PATH);
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toBe("image/jpeg");
	});

	test("the footer links the brand's home and Localman's privacy policy and terms", async () => {
		const body = (await page()).body;
		expect(body).toContain(
			'href="https://hoandat.com" data-id="foot-home">An app from hoandat.com</a>',
		);
		expect(body).toContain(
			'href="https://localman.hoandat.com/privacy" data-id="foot-privacy"',
		);
		expect(body).toContain(
			'href="https://localman.hoandat.com/terms" data-id="foot-terms"',
		);
	});

	test("serves the account app's fonts (Inter, JetBrains Mono) from static/fonts", async () => {
		expect((await page()).body).toContain(
			'<link rel="stylesheet" href="/assets/css/fonts.css">',
		);
		const css = await harness.request("/assets/css/fonts.css");
		expect(css.status).toBe(200);
		for (const [, url] of css.body.matchAll(/url\("([^"]+)"\)/g)) {
			expect((await harness.request(url ?? "")).status).toBe(200);
		}
	});

	test("every page links the Tunelo favicon set", async () => {
		const body = (await page()).body;
		expect(body).toContain('<link rel="icon" href="/favicon.ico"');
		expect(body).toContain(
			'<link rel="icon" href="/icon.svg" type="image/svg+xml">',
		);
		expect(body).toContain(
			'<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
		);
	});

	test("web.css uses colours from tokens only", () => {
		const css = readFileSync(
			fileURLToPath(new URL("../../../static/css/web.css", import.meta.url)),
			"utf8",
		);
		expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i);
	});

	test("other hosts and other paths fall through to the relay as before", async () => {
		const oldApex = await harness.request("/", {
			host: "tunnel.example.test",
		});
		expect(oldApex.status).toBe(400);
		expect(oldApex.body).toBe(RELAY_FALLBACK);
		const unknown = await harness.request("/health-or-anything");
		expect(unknown.body).toBe(RELAY_FALLBACK);
		expect(unknown.headers["content-security-policy"]).toBeUndefined();
		expect(await WebSessionModel.countDocuments()).toBe(1);
	});
});

test("an oversized form is a client error, not a crash", async () => {
	const res = await harness.request("/auth/logout", {
		method: "POST",
		cookie: session,
		form: { csrf: "x".repeat(10_000) },
	});
	expect(res.status).toBe(413);
	expect(await WebSessionModel.countDocuments()).toBe(1);
});
