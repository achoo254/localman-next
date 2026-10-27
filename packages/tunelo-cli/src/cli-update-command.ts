/** CLI handler for `tunelo update`: self-update from the latest GitHub release */

import { type SpawnOptions, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	TUNELO_LATEST_RELEASE_API,
	tuneloTarballUrl,
	versionFromReleaseTag,
} from "@tunelo/shared";
import chalk from "chalk";
import type { Command } from "commander";
import { VERSION } from "./version.js";

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
 * concatenate it unescaped. The manager is a two-value union, the release URL is
 * fixed, and the only remote input, the version from the GitHub API, must match
 * plain semver (`versionFromReleaseTag`), so no shell syntax can reach the shell.
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

/** Reads the version of the latest Tunelo release from the GitHub API */
export async function fetchLatestVersion(
	fetchImpl: typeof fetch = fetch,
): Promise<string> {
	const response = await fetchImpl(TUNELO_LATEST_RELEASE_API, {
		headers: { Accept: "application/vnd.github+json" },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
	const body = (await response.json()) as { tag_name?: unknown };
	const version =
		typeof body.tag_name === "string"
			? versionFromReleaseTag(body.tag_name)
			: null;
	if (!version) throw new Error("the latest release is not a Tunelo release");
	return version;
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
				console.log(chalk.gray("  Checking the latest release..."));
				latest = await fetchLatestVersion();
			} catch (err) {
				console.log(
					chalk.red(
						`  Error: cannot read the latest release — ${(err as Error).message}`,
					),
				);
				console.log(
					chalk.gray(
						`  Update manually: ${manager} ${buildInstallArgs(manager, tuneloTarballUrl()).join(" ")}`,
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
				code = await runInstall(manager, tuneloTarballUrl(latest));
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
