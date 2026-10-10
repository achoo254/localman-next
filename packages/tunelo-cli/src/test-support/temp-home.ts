import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

/** Points HOME (hence ~/.tunelo) at a fresh temp dir for every test. */
export function useTempHome(): { dir: () => string } {
	let dir = "";
	const original = process.env.HOME;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "tunelo-home-"));
		process.env.HOME = dir;
	});
	afterEach(() => {
		process.env.HOME = original;
		rmSync(dir, { recursive: true, force: true });
	});
	return { dir: () => dir };
}
