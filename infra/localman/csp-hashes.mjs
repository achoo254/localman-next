// Prints the CSP `script-src` sources ('sha256-…' …) of every inline
// <script> in the built web app, for deploy.sh to put into the nginx
// config. Hashes come from dist/index.html, not the source, because the
// build minifies the theme and #app scripts and writes a loader script
// whose asset names change with every build. A script with `src` is
// covered by 'self' and skipped.
//   node infra/localman/csp-hashes.mjs [apps/web/dist/index.html]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const HAS_SRC = /\bsrc\s*=/i;

const file = process.argv[2] ?? "apps/web/dist/index.html";
let html;
try {
	html = readFileSync(file, "utf8");
} catch (error) {
	const reason = error instanceof Error ? error.message : String(error);
	process.stderr.write(`csp-hashes: cannot read ${file}: ${reason}\n`);
	process.exit(1);
}

const sources = new Set();
for (const [, attributes, body] of html.matchAll(INLINE_SCRIPT)) {
	if (HAS_SRC.test(attributes)) continue;
	const digest = createHash("sha256").update(body, "utf8").digest("base64");
	sources.add(`'sha256-${digest}'`);
}

if (sources.size === 0) {
	process.stderr.write(`csp-hashes: no inline <script> in ${file}\n`);
	process.exit(1);
}
process.stderr.write(`csp-hashes: ${sources.size} inline script(s)\n`);
process.stdout.write(`${[...sources].join(" ")}\n`);
