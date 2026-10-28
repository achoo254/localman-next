import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/*
 * The web app loads tokens.css from @achoo254/app-shell, the copy every
 * hoandat.com app shares. packages/design-tokens/tokens.css, where that copy
 * came from, still feeds check:tokens, the contrast tests and the Tunelo
 * console (apps/tunelo-server/static/css/tokens.css); while both exist they
 * must be the same file, or the checks would pass on colours the web app
 * does not use. A token change goes into shared-next first.
 */
const webRequire = createRequire(
	new URL("../../apps/web/package.json", import.meta.url),
);

describe("design tokens", () => {
	it("are the tokens of the shared app shell, byte for byte", () => {
		const shared = readFileSync(
			webRequire.resolve("@achoo254/app-shell/tokens.css"),
			"utf8",
		);
		const local = readFileSync(
			new URL("../../packages/design-tokens/tokens.css", import.meta.url),
			"utf8",
		);
		expect(local).toBe(shared);
	});
});
