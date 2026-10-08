import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { Command } from "commander";
import {
	getApiBaseUrl,
	initDeviceLogin,
	pollDeviceLogin,
	verifyKey,
} from "./api-client.js";
import { loadConfig, saveConfig } from "./config.js";

function getServerBaseUrl(): string {
	const config = loadConfig();
	const serverUrl =
		process.env.TUNELO_SERVER ?? config.server ?? "wss://tunnel.inetdev.io.vn";
	return getApiBaseUrl(serverUrl);
}

/** Stable per-machine id; created once and persisted in the config. */
function getDeviceId(): string {
	const config = loadConfig();
	if (config.deviceId) return config.deviceId;
	const deviceId = randomUUID();
	saveConfig({ ...config, deviceId });
	return deviceId;
}

function saveKey(token: string): void {
	saveConfig({ ...loadConfig(), key: token });
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** Open a URL in the default browser — cross-platform, no deps. */
async function openBrowser(url: string): Promise<void> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const run = promisify(execFile);
	try {
		if (process.platform === "darwin") await run("open", [url]);
		else if (process.platform === "win32")
			await run("cmd", ["/c", "start", "", url]);
		else await run("xdg-open", [url]);
	} catch {
		// ignore — the URL is printed for manual opening
	}
}

export function registerLoginCommands(program: Command): void {
	program
		.command("login")
		.description("Authorize this device via the browser")
		.option("-k, --key <token>", "Use an existing access token (skip browser)")
		.option("-f, --force", "Re-authorize even if already signed in")
		.action(async (options: { key?: string; force?: boolean }) => {
			const baseUrl = getServerBaseUrl();

			// Headless path: verify and save a token directly.
			if (options.key) {
				if (!(await verifyKey(baseUrl, options.key).catch(() => false))) {
					console.error("  Invalid access token.");
					process.exit(1);
				}
				saveKey(options.key);
				console.log("  ✓ Verified & saved. Run: tunelo http <port>");
				return;
			}

			// Idempotent: a still-valid token on this device needs no re-auth.
			const existing = loadConfig().key;
			if (existing && !options.force) {
				if (await verifyKey(baseUrl, existing).catch(() => false)) {
					console.log(
						"  Already authorized on this device. (use --force to redo)",
					);
					return;
				}
			}

			const deviceId = getDeviceId();
			let requestId: string;
			try {
				requestId = await initDeviceLogin(baseUrl, deviceId, hostname());
			} catch (err) {
				console.error(`  Could not reach server: ${(err as Error).message}`);
				process.exit(1);
			}

			const url = `${baseUrl}/login?req=${encodeURIComponent(requestId)}`;
			console.log();
			console.log("  Opening browser to authorize this device...");
			console.log(`  ${url}`);
			console.log();
			console.log("  Waiting for approval in the browser...");
			await openBrowser(url);

			const deadline = Date.now() + 5 * 60 * 1000;
			while (Date.now() < deadline) {
				await sleep(2000);
				let result: Awaited<ReturnType<typeof pollDeviceLogin>>;
				try {
					result = await pollDeviceLogin(baseUrl, requestId);
				} catch {
					continue; // transient — keep polling
				}
				if (result.status === "approved") {
					saveKey(result.token);
					console.log(
						"  ✓ Device authorized & signed in. Run: tunelo http <port>",
					);
					return;
				}
				if (result.status === "expired") {
					console.error("  Login request expired. Run `tunelo login` again.");
					process.exit(1);
				}
			}
			console.error("  Timed out waiting for approval.");
			process.exit(1);
		});

	program
		.command("logout")
		.description("Remove the saved access token")
		.action(() => {
			const config = loadConfig();
			if (!config.key) {
				console.log("  Not logged in.");
				return;
			}
			// Keep deviceId so re-login stays idempotent for this machine.
			saveConfig({ ...config, key: undefined });
			console.log("  Logged out. Access token removed.");
		});
}
