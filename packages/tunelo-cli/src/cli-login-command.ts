import { createInterface } from "node:readline";
import type { Command } from "commander";
import { claimDeviceCode, getApiBaseUrl, verifyKey } from "./api-client.js";
import { loadConfig, saveConfig } from "./config.js";

function getServerBaseUrl(): string {
	const config = loadConfig();
	const serverUrl =
		process.env.TUNELO_SERVER ?? config.server ?? "wss://tunnel.inetdev.io.vn";
	return getApiBaseUrl(serverUrl);
}

function prompt(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
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

function save(token: string): void {
	const config = loadConfig();
	config.key = token;
	saveConfig(config);
}

export function registerLoginCommands(program: Command): void {
	program
		.command("login")
		.description("Authorize this device via the browser")
		.option("-k, --key <token>", "Use an existing access token (skip browser)")
		.action(async (options: { key?: string }) => {
			const baseUrl = getServerBaseUrl();

			// Automation path: verify and save a token directly.
			if (options.key) {
				let ok = false;
				try {
					ok = await verifyKey(baseUrl, options.key);
				} catch (err) {
					console.error(`  Could not reach server: ${(err as Error).message}`);
					process.exit(1);
				}
				if (!ok) {
					console.error("  Invalid access token.");
					process.exit(1);
				}
				save(options.key);
				console.log("  ✓ Verified & saved. Run: tunelo http <port>");
				return;
			}

			// Interactive path: open the browser, user pastes the shown code.
			const loginUrl = `${baseUrl}/login`;
			console.log();
			console.log("  Opening browser to authorize this device...");
			console.log(`  ${loginUrl}`);
			console.log();
			await openBrowser(loginUrl);

			const code = await prompt("  Paste the code shown in your browser: ");
			if (!code) {
				console.error("  No code entered.");
				process.exit(1);
			}

			let token: string;
			try {
				token = await claimDeviceCode(baseUrl, code);
			} catch (err) {
				console.error(`  ${(err as Error).message}`);
				process.exit(1);
			}

			save(token);
			console.log("  ✓ Device authorized & signed in. Run: tunelo http <port>");
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
			config.key = undefined;
			saveConfig(config);
			console.log("  Logged out. Access token removed.");
		});
}
