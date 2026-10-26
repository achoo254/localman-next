/**
 * `pnpm check:tunelo-boundary` — keeps Tunelo shippable on its own
 * (docs/tunelo/system-architecture.md, "Boundary with Localman").
 *
 * Scans the sources of `apps/tunelo-server`, `packages/tunelo-cli` and
 * `packages/tunelo-shared` for imports of Localman packages outside each
 * package's allow list and for relative imports that leave the package.
 *
 * Exits 1 on any finding, printing `file:line` for each.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	type BoundaryViolation,
	TUNELO_PACKAGES,
	checkFile,
} from "./check-tunelo-boundary/scan-imports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "portal-dist"]);
const SOURCE_FILE = /\.(?:[cm]?[jt]s|tsx)$/;

async function listSources(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				return SKIP_DIRS.has(entry.name) ? [] : listSources(full);
			}
			return SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")
				? [full]
				: [];
		}),
	);
	return nested.flat();
}

async function main(): Promise<number> {
	const violations: BoundaryViolation[] = [];
	let scanned = 0;
	for (const pkg of TUNELO_PACKAGES) {
		const files = await listSources(path.join(ROOT, pkg.root));
		scanned += files.length;
		for (const full of files) {
			const file = path.relative(ROOT, full).split(path.sep).join("/");
			violations.push(...checkFile(file, await readFile(full, "utf8"), pkg));
		}
	}
	if (violations.length > 0) {
		console.error(
			`✗ ${violations.length} import(s) cross the Tunelo boundary (docs/tunelo/system-architecture.md):`,
		);
		for (const v of violations) {
			console.error(`  ${v.file}:${v.line}  ${v.specifier}  — ${v.reason}`);
		}
		return 1;
	}
	console.log(
		`✓ Tunelo stays inside its boundary (${scanned} files in ${TUNELO_PACKAGES.length} packages)`,
	);
	return 0;
}

main().then(
	(code) => {
		process.exitCode = code;
	},
	(error: unknown) => {
		console.error("check:tunelo-boundary crashed:", error);
		process.exitCode = 1;
	},
);
