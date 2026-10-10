import { loadConfig, updateConfig } from "./config.js";

export const DEFAULT_SERVER_URL = "https://tunnel.hoandat.com";
/** Hosts of the old domain; saved configs pointing there move over. */
const RETIRED_HOSTS = new Set(["tunnel.inetdev.io.vn"]);

function isRetired(url: string): boolean {
	try {
		return RETIRED_HOSTS.has(new URL(url).hostname);
	} catch {
		return false;
	}
}

/**
 * Server to use: `--server`, then `TUNELO_SERVER`, then the saved config,
 * then the default. A saved config on the retired domain is rewritten to
 * the new one once, and `onMigrated` is told so the user sees a notice.
 */
export function resolveServerUrl(
	flag?: string,
	onMigrated?: (from: string, to: string) => void,
): string {
	if (flag) return flag;
	if (process.env.TUNELO_SERVER) return process.env.TUNELO_SERVER;
	const saved = loadConfig().server;
	if (!saved) return DEFAULT_SERVER_URL;
	if (isRetired(saved)) {
		updateConfig((config) => ({ ...config, server: DEFAULT_SERVER_URL }));
		onMigrated?.(saved, DEFAULT_SERVER_URL);
		return DEFAULT_SERVER_URL;
	}
	return saved;
}

/** Notice printed (to stderr) when a saved server was migrated. */
export function printServerMigration(from: string, to: string): void {
	process.stderr.write(
		`  Tunelo moved: server ${from} → ${to} (config updated)\n`,
	);
}
