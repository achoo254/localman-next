// Writes the package.json installed next to the API bundle on the server:
// the npm dependencies left external by apps/api/scripts/build-api.ts,
// pinned to the exact versions this workspace resolved (and tested), so the
// server does not drift to newer releases inside the semver ranges.
// Workspace packages (@localman/*) are bundled and therefore omitted.
//   node infra/localman/runtime-manifest.mjs <output-file>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiRoot = join(repoRoot, "apps/api");

function fail(message) {
	process.stderr.write(`runtime-manifest: ${message}\n`);
	process.exit(1);
}

function readJson(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return fail(`cannot read ${file}: ${reason}`);
	}
}

const output = process.argv[2];
if (!output) fail("usage: runtime-manifest.mjs <output-file>");

const api = readJson(join(apiRoot, "package.json"));
const dependencies = {};
for (const name of Object.keys(api.dependencies ?? {}).sort()) {
	if (name.startsWith("@localman/")) continue;
	// pnpm links every direct dependency under apps/api/node_modules.
	const installed = readJson(
		join(apiRoot, "node_modules", name, "package.json"),
	);
	if (typeof installed.version !== "string") {
		fail(`${name} has no version in node_modules (run pnpm install)`);
	}
	dependencies[name] = installed.version;
}

const root = readJson(join(repoRoot, "package.json"));
const manifest = {
	name: "localman-api-runtime",
	private: true,
	type: "module",
	engines: root.engines,
	packageManager: root.packageManager,
	dependencies,
};
writeFileSync(output, `${JSON.stringify(manifest, null, "\t")}\n`);
