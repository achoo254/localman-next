/**
 * `tunelo update` of 1.12 when tunelo 2.x is not installed yet: runs the
 * install script of 2.x (pinned and checked by the script itself), then
 * offers to remove this npm package. Once 2.x is installed, `tunelo update`
 * goes to 2.x like every other command.
 */
import { type SpawnSyncOptions, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { TUNELO_INSTALL_SCRIPT_URLS } from "@tunelo/shared";
import { findTunelo2 } from "./tunelo-binary.js";

export const NPM_UNINSTALL = "npm uninstall -g tunelo";

/** The program and arguments that run the install script on this OS, or null when 2.x has no build for it. */
export function installScriptCommand(
	platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } | null {
	if (platform === "darwin") {
		return {
			command: "/bin/sh",
			args: [
				"-c",
				`curl -fsSL ${TUNELO_INSTALL_SCRIPT_URLS.macos} | sh -s -- en`,
			],
		};
	}
	if (platform === "win32") {
		return {
			command: "powershell.exe",
			args: [
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-Command",
				`& ([scriptblock]::Create((irm ${TUNELO_INSTALL_SCRIPT_URLS.windows}))) en`,
			],
		};
	}
	return null;
}

/** y/yes (any case) is yes; anything else, an empty answer included, is no. */
export function isYes(answer: string): boolean {
	return /^\s*y(es)?\s*$/i.test(answer);
}

async function ask(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

function run(command: string, args: string[]): number {
	const options: SpawnSyncOptions = { stdio: "inherit" };
	// npm is a .cmd shim on Windows, which needs a shell; its arguments are fixed.
	const result =
		process.platform === "win32" && command === "npm"
			? spawnSync([command, ...args].join(" "), { ...options, shell: true })
			: spawnSync(command, args, options);
	if (result.error) throw result.error;
	return result.status ?? 1;
}

export async function runUpdate(): Promise<number> {
	const install = installScriptCommand();
	if (!install) {
		console.error(
			"  tunelo 2.x is available for macOS and Windows only; tunelo 1.x stays retired here.",
		);
		return 1;
	}
	console.log("  Installing tunelo 2.x with its install script...");
	const code = run(install.command, install.args);
	if (code !== 0 || !findTunelo2()) {
		console.error(
			`  The install did not finish (exit ${code}); nothing else was changed.`,
		);
		return code || 1;
	}
	console.log("  ✓ tunelo 2.x is installed. Open a new terminal to use it.");
	if (!process.stdin.isTTY) {
		console.log(
			`  Remove this old npm package when you like: ${NPM_UNINSTALL}`,
		);
		return 0;
	}
	const answer = await ask(
		`  Remove the old npm package now (${NPM_UNINSTALL})? [y/N] `,
	);
	if (!isYes(answer)) {
		console.log(`  Kept. Remove it later with: ${NPM_UNINSTALL}`);
		return 0;
	}
	return run("npm", ["uninstall", "-g", "tunelo"]);
}
