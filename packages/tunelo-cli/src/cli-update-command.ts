/** CLI handler for `tunelo update` — self-update from the configured registry */

import { type SpawnOptions, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import type { Command } from "commander";
import { PACKAGE_NAME, VERSION } from "./version.js";

/** Windows ships npm/pnpm as .cmd shims, which Node refuses to spawn directly */
const isWindows = process.platform === "win32";

export type PackageManager = "npm" | "pnpm";

/** Infers the installer from where this file ended up on disk */
export function detectPackageManager(modulePath: string): PackageManager {
	const normalized = modulePath.split(path.win32.sep).join(path.posix.sep);
	return normalized.includes("/pnpm/") ? "pnpm" : "npm";
}

/** Returns >0 when `a` is newer than `b`, <0 when older, 0 when equal */
export function compareVersions(a: string, b: string): number {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split("-")[0]
			.split(".")
			.map((part) => Number.parseInt(part, 10) || 0);
	const left = parse(a);
	const right = parse(b);
	for (let i = 0; i < Math.max(left.length, right.length); i++) {
		const diff = (left[i] ?? 0) - (right[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** Builds the install argv for the detected package manager */
export function buildInstallArgs(
	manager: PackageManager,
	target: string,
): string[] {
	return manager === "pnpm" ? ["add", "-g", target] : ["install", "-g", target];
}

/**
 * Spawns npm/pnpm. On Windows the .cmd shim needs a shell, so the whole command
 * goes through as a single string — passing an argv array alongside `shell` would
 * concatenate it unescaped. Every token here is a compile-time constant: the
 * manager is a two-value union and the package name is hard-coded, so nothing
 * user-controlled ever reaches the shell.
 */
function spawnManager(
	manager: PackageManager,
	args: string[],
	options: SpawnOptions,
) {
	return isWindows
		? spawn([manager, ...args].join(" "), { ...options, shell: true })
		: spawn(manager, args, options);
}

/** Asks the registry for the newest published version */
function fetchLatestVersion(manager: PackageManager): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawnManager(manager, ["view", PACKAGE_NAME, "version"], {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 60_000,
		});
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(stderr.trim().split("\n").pop() ?? `exit ${code}`));
				return;
			}
			const version = stdout.trim().split("\n").pop()?.trim();
			if (!version) {
				reject(new Error("Registry returned no version"));
				return;
			}
			resolve(version);
		});
	});
}

/** Runs the install and resolves with the child's exit code */
function runInstall(manager: PackageManager, target: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawnManager(manager, buildInstallArgs(manager, target), {
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("close", (code) => resolve(code ?? 1));
	});
}

export function registerUpdateCommand(program: Command): void {
	program
		.command("update")
		.description("Update tunelo to the latest published version")
		.option("--check", "Only report whether an update exists")
		.action(async (options: { check?: boolean }) => {
			const manager = detectPackageManager(fileURLToPath(import.meta.url));

			let latest: string;
			try {
				console.log(chalk.gray("  Checking registry..."));
				latest = await fetchLatestVersion(manager);
			} catch (err) {
				console.log(
					chalk.red(
						`  Error: cannot reach registry — ${(err as Error).message}`,
					),
				);
				console.log(
					chalk.gray(
						`  Update manually: ${manager} ${buildInstallArgs(manager, `${PACKAGE_NAME}@latest`).join(" ")}`,
					),
				);
				process.exitCode = 1;
				return;
			}

			if (compareVersions(latest, VERSION) <= 0) {
				console.log(
					`  ${chalk.green("Already up to date")} — v${VERSION} is the latest.`,
				);
				return;
			}

			console.log(
				`  Update available: ${chalk.gray(`v${VERSION}`)} → ${chalk.cyan(`v${latest}`)}`,
			);

			if (options.check) {
				console.log(chalk.gray("  Run `tunelo update` to install it."));
				return;
			}

			console.log(chalk.gray(`  Installing via ${manager}...`));
			let code: number;
			try {
				code = await runInstall(manager, `${PACKAGE_NAME}@latest`);
			} catch (err) {
				console.log(
					chalk.red(
						`  Error: ${manager} failed to start — ${(err as Error).message}`,
					),
				);
				process.exitCode = 1;
				return;
			}

			if (code !== 0) {
				console.log(chalk.red(`  Update failed (${manager} exited ${code}).`));
				process.exitCode = code;
				return;
			}

			console.log(`  ${chalk.green("Updated")} to v${latest}.`);
			// Running tunnels keep the old code in memory — restart them to pick this up.
			console.log(chalk.gray("  Restart any running tunnels to apply."));
		});
}
