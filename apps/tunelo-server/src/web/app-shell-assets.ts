import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Files of @achoo254/app-shell the console serves under /assets/app-shell:
 * the brand's design tokens, the shared header and footer stylesheet, and
 * the script that runs the theme switch (applied before the first paint,
 * so no inline script is needed under the console's CSP).
 */
export const APP_SHELL_FILES = [
	"tokens.css",
	"app-shell.css",
	"app-shell-enhance.js",
] as const;

export const APP_SHELL_PATH = "/assets/app-shell";

/**
 * Where those files are: `static/app-shell` next to the bundle, where
 * scripts/tunelo/build-server.ts copies them (the package is bundled, not
 * installed on the server), else the installed package (running from src/).
 */
export function findAppShellDir(staticDir: string | null): string | null {
	const copied = staticDir ? join(staticDir, "app-shell") : null;
	if (copied && existsSync(join(copied, APP_SHELL_FILES[0]))) return copied;
	try {
		const require = createRequire(import.meta.url);
		return dirname(require.resolve("@achoo254/app-shell/app-shell-enhance.js"));
	} catch {
		return null;
	}
}
