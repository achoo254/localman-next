import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const clientDir = resolve(root, "packages/client");
const distDir = resolve(clientDir, "dist");

// npm deps kept external in the bundle — users install these at runtime.
const runtimeDeps = ["chalk", "commander", "pino", "ws"];

await build({
	entryPoints: [resolve(clientDir, "src/cli.ts")],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: resolve(distDir, "cli.js"),
	sourcemap: true,
	minify: false,
	// Resolve @tunelo/shared from monorepo source (bundled into cli.js)
	alias: {
		"@tunelo/shared": resolve(root, "packages/shared/src/index.ts"),
	},
	// Externalize node builtins and heavy deps that users install
	external: runtimeDeps,
	// Shebang comes from the entry file (src/cli.ts); esbuild preserves it at the
	// top of the bundle. Keep only a marker comment here to avoid a duplicate shebang.
	banner: {
		js: "// Tunelo CLI — bundled with esbuild",
	},
});

// Generate a self-contained package.json inside dist/ so the CLI publishes from
// there. @tunelo/shared is bundled in, so it must NOT stay a workspace dep; keep
// only the externalized runtime deps. Paths are relative to dist/ (publish root).
// The explicit `files` list is a safety guard: publishing from dist/ must never
// ship the CI .npmrc (it holds the CI job token).
const clientPkg = JSON.parse(
	readFileSync(resolve(clientDir, "package.json"), "utf-8"),
) as Record<string, unknown>;
const allDeps = (clientPkg.dependencies ?? {}) as Record<string, string>;

const distPkg = {
	name: clientPkg.name,
	version: clientPkg.version,
	type: clientPkg.type,
	description: clientPkg.description,
	keywords: clientPkg.keywords,
	repository: clientPkg.repository,
	homepage: clientPkg.homepage,
	license: clientPkg.license,
	engines: clientPkg.engines,
	bin: { tunelo: "cli.js" },
	main: "cli.js",
	files: ["cli.js", "cli.js.map", "README.md"],
	dependencies: Object.fromEntries(
		Object.entries(allDeps).filter(([name]) => runtimeDeps.includes(name)),
	),
	publishConfig: clientPkg.publishConfig,
};
writeFileSync(
	resolve(distDir, "package.json"),
	`${JSON.stringify(distPkg, null, 2)}\n`,
);

// Copy the repo README so the registry package page has content.
const readme = resolve(root, "README.md");
if (existsSync(readme)) copyFileSync(readme, resolve(distDir, "README.md"));

console.log(
	`Built packages/client/dist/ — cli.js + package.json (${distPkg.name}@${distPkg.version})`,
);
