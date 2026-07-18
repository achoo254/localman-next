import { createInterface } from "node:readline";
import type { Command } from "commander";
import { getApiBaseUrl, verifyKey } from "./api-client.js";
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

export function registerLoginCommands(program: Command): void {
	program
		.command("login")
		.description("Authorize this device with an access token")
		.option("-k, --key <token>", "Access token (skips the interactive prompt)")
		.action(async (options: { key?: string }) => {
			const token =
				options.key ?? (await prompt("  Paste your Tunelo access token: "));
			if (!token) {
				console.error("  No token provided.");
				process.exit(1);
			}

			const baseUrl = getServerBaseUrl();
			let ok = false;
			try {
				ok = await verifyKey(baseUrl, token);
			} catch (err) {
				console.error(`  Could not reach server: ${(err as Error).message}`);
				process.exit(1);
			}

			if (!ok) {
				console.error("  Invalid access token.");
				process.exit(1);
			}

			const config = loadConfig();
			config.key = token;
			saveConfig(config);
			console.log("  ✓ Verified & saved. Run: tunelo http <port>");
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
