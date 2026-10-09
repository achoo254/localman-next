// Writes the package.json installed next to the API bundle on the server,
// from the output of `pnpm --filter @localman/api deploy --prod`:
// - drops the workspace packages (@localman/*), which build-api.ts bundles
//   into dist/*.mjs, and the scripts and devDependencies;
// - keeps the exact versions pnpm deploy pinned from the workspace lockfile,
//   minus the peer suffix it leaves in some specifiers
//   ("8.7.1(express@5.2.1)" is a lockfile key, not a valid specifier).
// deploy.sh then prunes the lockfile written by pnpm deploy to these
// dependencies (`pnpm install --lockfile-only`, resolutions unchanged), and
// the server installs it with --frozen-lockfile.
//   node infra/localman/runtime-manifest.mjs <deploy-package.json> <output-file>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PEER_SUFFIX = /\(.*$/;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

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

const [input, output] = process.argv.slice(2);
if (!input || !output) {
	fail("usage: runtime-manifest.mjs <deploy-package.json> <output-file>");
}

const deployed = readJson(input);
const dependencies = {};
for (const [name, specifier] of Object.entries(deployed.dependencies ?? {})) {
	if (name.startsWith("@localman/")) continue;
	const version = String(specifier).replace(PEER_SUFFIX, "");
	if (!EXACT_VERSION.test(version)) {
		fail(`${name}: expected an exact version from pnpm deploy`);
	}
	dependencies[name] = version;
}
if (Object.keys(dependencies).length === 0) fail("no runtime dependencies");

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
