/**
 * Copies the protocol sources of `@tunelo/shared` into `src/shared/`, so the
 * published package carries them instead of depending on a workspace package
 * that git installs cannot resolve. `src/shared/shared-copy.test.ts` fails
 * when a copy drifts from its original; run this script to fix it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SHARED_FILES, copyHeader } from "../src/shared/shared-files.js";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedSrc = resolve(packageDir, "../tunelo-shared/src");

for (const name of SHARED_FILES) {
	const original = readFileSync(resolve(sharedSrc, name), "utf-8");
	writeFileSync(
		resolve(packageDir, "src/shared", name),
		`${copyHeader(name)}${original}`,
	);
}
process.stdout.write(`Copied ${SHARED_FILES.join(", ")} into src/shared/\n`);
