/**
 * `pnpm check:brand` (part of `pnpm lint`): brand.config.json passes its
 * schema, and no product code hard-codes the product name; code reads it
 * from `@localman/brand` (`brand.appName`) so a rename is brand.config.json,
 * `pnpm brand:gen` and a rebuild. The rule and its ignore marker are in
 * scripts/check-brand/scan-brand.ts. Tunelo is a separate product and is
 * not checked against its own name. apps/web/public is served verbatim
 * without a build step, so it is skipped; apps/web/src/brand-static-files.test.ts
 * keeps its product name equal to brand.appName instead.
 *
 * Exits 1 on any failure, printing `file:line` for each literal.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBrandConfig } from "../packages/brand/src/build.js";
import {
	type BrandViolation,
	CODE_FILE,
	findBrandLiterals,
} from "./check-brand/scan-brand.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCANNED_DIRS = ["apps", "packages"];
const SKIPPED_DIRS = new Set([
	"node_modules",
	"dist",
	"portal-dist",
	"generated",
]);
/** Served verbatim (no build, no import); guarded by brand-static-files.test.ts. */
const SKIPPED_PATHS = new Set([path.join(ROOT, "apps", "web", "public")]);

async function listCodeFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			if (entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) {
				return [];
			}
			const full = path.join(dir, entry.name);
			if (SKIPPED_PATHS.has(full)) return [];
			if (entry.isDirectory()) return listCodeFiles(full);
			return CODE_FILE.test(entry.name) ? [full] : [];
		}),
	);
	return nested.flat();
}

async function main(): Promise<number> {
	const { appName } = loadBrandConfig();
	const files = (
		await Promise.all(
			SCANNED_DIRS.map((dir) => listCodeFiles(path.join(ROOT, dir))),
		)
	)
		.flat()
		.sort();
	const violations: BrandViolation[] = (
		await Promise.all(
			files.map(async (file) =>
				findBrandLiterals(
					await readFile(file, "utf8"),
					path.relative(ROOT, file).split(path.sep).join("/"),
					appName,
				),
			),
		)
	).flat();
	if (violations.length > 0) {
		console.error(
			`✗ ${violations.length} hard-coded product name(s) "${appName}"; read brand.appName from @localman/brand:`,
		);
		for (const v of violations) console.error(`  ${v.file}:${v.line}`);
		return 1;
	}
	console.log(
		`✓ brand.config.json is valid; no hard-coded "${appName}" in ${files.length} code files`,
	);
	return 0;
}

main().then(
	(code) => {
		process.exitCode = code;
	},
	(error: unknown) => {
		console.error("check:brand crashed:", error);
		process.exitCode = 1;
	},
);
