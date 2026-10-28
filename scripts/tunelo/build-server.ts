import { execSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const distDir = resolve(root, "dist/tunelo-server");

// Clean previous build
if (existsSync(distDir)) {
	rmSync(distDir, { recursive: true, force: true });
}

// Build shared (server bundle imports from @tunelo/shared)
console.log("Building @tunelo/shared...");
execSync("pnpm --filter @tunelo/shared build", { stdio: "inherit", cwd: root });

// Read server's runtime deps to compute external list
// Bundle @tunelo/* workspace packages INTO server.mjs (so VPS doesn't need them)
// Externalize npm packages — VPS runs `pnpm install --prod` to provide them
const serverPkg = JSON.parse(
	readFileSync(resolve(root, "apps/tunelo-server/package.json"), "utf-8"),
);
const npmDeps = Object.keys(
	serverPkg.dependencies as Record<string, string>,
).filter(
	(name) => !name.startsWith("@tunelo/") && !name.startsWith("@localman/"),
);

console.log("Bundling server...");
await build({
	entryPoints: [resolve(root, "apps/tunelo-server/src/server.ts")],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: resolve(distDir, "server.mjs"),
	sourcemap: true,
	minify: false,
	external: npmDeps,
	banner: {
		js: "// Tunelo Server — bundled with esbuild",
	},
});

// Generate sanitized package.json for production install on VPS
// - Strip workspace dep (@tunelo/shared is bundled into server.mjs)
// - Strip devDependencies
const prodPkg = {
	name: serverPkg.name,
	version: serverPkg.version,
	type: serverPkg.type,
	main: "server.mjs",
	scripts: { start: "node server.mjs" },
	dependencies: Object.fromEntries(
		Object.entries(serverPkg.dependencies as Record<string, string>).filter(
			([name]) =>
				!name.startsWith("@tunelo/") && !name.startsWith("@localman/"),
		),
	),
};
writeFileSync(
	resolve(distDir, "package.json"),
	`${JSON.stringify(prodPkg, null, 2)}\n`,
);
console.log("Wrote dist/tunelo-server/package.json (production deps only)");

// Web console assets (token + page CSS), served at /assets next to server.mjs
cpSync(resolve(root, "apps/tunelo-server/static"), resolve(distDir, "static"), {
	recursive: true,
});
console.log("Copied web console assets to dist/tunelo-server/static");

// The shared shell's files (@achoo254/app-shell is bundled into server.mjs,
// not installed on the VPS): static/app-shell, served at /assets/app-shell.
const serverRequire = createRequire(
	resolve(root, "apps/tunelo-server/package.json"),
);
const appShellOut = resolve(distDir, "static/app-shell");
mkdirSync(appShellOut, { recursive: true });
for (const file of ["tokens.css", "app-shell.css", "app-shell-enhance.js"]) {
	copyFileSync(
		serverRequire.resolve(`@achoo254/app-shell/${file}`),
		resolve(appShellOut, file),
	);
}
console.log(
	"Copied @achoo254/app-shell assets to dist/tunelo-server/static/app-shell",
);

console.log(
	"Build complete: dist/tunelo-server/server.mjs + package.json + static/",
);
