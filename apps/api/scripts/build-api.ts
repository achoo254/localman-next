import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { z } from "zod";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(apiRoot, "dist");

const manifest = z
	.object({ dependencies: z.record(z.string(), z.string()) })
	.parse(JSON.parse(readFileSync(resolve(apiRoot, "package.json"), "utf8")));

// Workspace packages (`workspace:` specifiers: @localman/*, @tunelo/shared)
// get bundled, so the server never installs them; npm dependencies stay
// external and load from node_modules at runtime
// (infra/localman/runtime-manifest.mjs skips the same names).
const external = Object.entries(manifest.dependencies)
	.filter(([, specifier]) => !specifier.startsWith("workspace:"))
	.map(([name]) => name);

rmSync(distDir, { recursive: true, force: true });
// One self-contained file per entry: the server (`dist/main.mjs`, run by
// pm2) and the operator commands `dist/cleanup-abandoned-projects.mjs` and
// `dist/create-tenant-indexes.mjs` (activate-release.sh runs it before the
// switch), run on the server with the same env file.
await build({
	entryPoints: {
		main: resolve(apiRoot, "src/main.ts"),
		"cleanup-abandoned-projects": resolve(
			apiRoot,
			"scripts/cleanup-abandoned-projects.ts",
		),
		"create-tenant-indexes": resolve(
			apiRoot,
			"scripts/create-tenant-indexes.ts",
		),
	},
	outdir: distDir,
	outExtension: { ".js": ".mjs" },
	bundle: true,
	platform: "node",
	target: "node22",
	format: "esm",
	sourcemap: true,
	external,
	logLevel: "info",
});
