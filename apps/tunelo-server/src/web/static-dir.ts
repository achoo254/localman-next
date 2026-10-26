import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `static/` next to the bundle (`dist/tunelo-server/server.mjs`) in
 * production, or at the package root when running from `src/`.
 */
export function findStaticDir(): string | null {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [join(here, "static"), join(here, "..", "..", "static")];
	return candidates.find((dir) => existsSync(join(dir, "css"))) ?? null;
}
