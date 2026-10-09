/**
 * `pnpm check:i18n` — copy guard for the web app (docs/i18n.md).
 *
 * 1. No Vietnamese in `apps/web/src` outside the Vietnamese dictionary
 *    (`src/i18n/messages/vi/`) and test files: user-facing text goes
 *    through `t()`. Files not moved yet are listed in
 *    `check-i18n/pending-files.ts`; the count still pending is printed, and
 *    a listed file that is clean must leave the list.
 * 2. No competitor name (mockapi, Postman) in `apps/web/src` (tests and
 *    comments aside) or in `apps/web/index.html`.
 *
 * Exits 1 on any failure, printing `file:line` for each finding.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PENDING_FILES } from "./check-i18n/pending-files.js";
import {
	type CopyRule,
	type CopyViolation,
	isTestFile,
	scanHtml,
	scanScript,
} from "./check-i18n/scan-copy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const INDEX_HTML = path.join(ROOT, "apps/web/index.html");
const VI_DICTIONARY = "apps/web/src/i18n/messages/vi/";

async function listScripts(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) return listScripts(full);
			return /\.tsx?$/.test(entry.name) ? [full] : [];
		}),
	);
	return nested.flat();
}

async function scanWebSources(): Promise<CopyViolation[]> {
	const files = (await listScripts(WEB_SRC))
		.map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
		.filter((file) => !isTestFile(file))
		.sort();
	const results = await Promise.all(
		files.map(async (file) => {
			const rules = new Set<CopyRule>(["competitor"]);
			if (!file.startsWith(VI_DICTIONARY)) rules.add("vietnamese");
			const content = await readFile(path.join(ROOT, file), "utf8");
			return scanScript(content, file, rules);
		}),
	);
	return results.flat();
}

function print(violations: readonly CopyViolation[]): void {
	for (const v of violations) {
		console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text.slice(0, 90)}`);
	}
}

async function main(): Promise<number> {
	let failed = false;
	const html = scanHtml(
		await readFile(INDEX_HTML, "utf8"),
		path.relative(ROOT, INDEX_HTML),
	);
	const all = [...(await scanWebSources()), ...html];
	const pending = new Set(PENDING_FILES);

	const competitors = all.filter((v) => v.rule === "competitor");
	if (competitors.length > 0) {
		failed = true;
		console.error(`✗ ${competitors.length} competitor name(s) in the web app:`);
		print(competitors);
	} else {
		console.log("✓ No competitor names in apps/web/src or index.html");
	}

	const vietnamese = all.filter((v) => v.rule === "vietnamese");
	const unexpected = vietnamese.filter((v) => !pending.has(v.file));
	if (unexpected.length > 0) {
		failed = true;
		console.error(
			`✗ ${unexpected.length} Vietnamese text(s) outside the vi dictionary (use t(), docs/i18n.md):`,
		);
		print(unexpected);
	}
	const stillPending = new Set(vietnamese.map((v) => v.file));
	const stale = [...pending].filter((file) => !stillPending.has(file));
	if (stale.length > 0) {
		failed = true;
		console.error(
			"✗ No Vietnamese left in these files; remove them from scripts/check-i18n/pending-files.ts:",
		);
		for (const file of stale) console.error(`  ${file}`);
	}
	const pendingCount = vietnamese.length - unexpected.length;
	if (unexpected.length === 0) {
		console.log(
			pending.size === 0
				? "✓ No Vietnamese outside the vi dictionary"
				: `✓ No Vietnamese outside the vi dictionary and the pending list (${stillPending.size} file(s), ${pendingCount} text(s) still to move)`,
		);
	}
	return failed ? 1 : 0;
}

main().then(
	(code) => {
		process.exitCode = code;
	},
	(error: unknown) => {
		console.error("check:i18n crashed:", error);
		process.exitCode = 1;
	},
);
