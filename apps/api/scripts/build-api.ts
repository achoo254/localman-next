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

// Workspace packages (@localman/*) are TypeScript sources and get bundled;
// npm dependencies stay external and load from node_modules at runtime.
const external = Object.keys(manifest.dependencies).filter(
	(name) => !name.startsWith("@localman/"),
);

rmSync(distDir, { recursive: true, force: true });
// One self-contained file per entry: the server (`dist/main.mjs`, run by
// pm2) and the operator command `dist/cleanup-abandoned-projects.mjs`, run
// on the server with the same env file.
await build({
	entryPoints: {
		main: resolve(apiRoot, "src/main.ts"),
		"cleanup-abandoned-projects": resolve(
			apiRoot,
			"scripts/cleanup-abandoned-projects.ts",
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
