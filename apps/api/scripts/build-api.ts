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
await build({
	entryPoints: [resolve(apiRoot, "src/main.ts")],
	outfile: resolve(distDir, "main.mjs"),
	bundle: true,
	platform: "node",
	target: "node22",
	format: "esm",
	sourcemap: true,
	external,
	logLevel: "info",
});
