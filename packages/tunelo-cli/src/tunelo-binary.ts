/**
 * Where tunelo 2.x lives: its install script puts the binary at one fixed
 * path per OS (`%LOCALAPPDATA%\tunelo\tunelo.exe`, `~/.local/bin/tunelo`).
 * Only that path counts, and only when the file there says it is 2.x: on
 * PATH, `tunelo` may well be this npm package again.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, constants as osConstants } from "node:os";
import { join } from "node:path";

/** Set on the processes this package starts, so 2.x never hands a command back. */
export const FORWARDED_ENV = "TUNELO_FROM_NPM_1X";

export function tunelo2Path(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	if (platform === "win32") {
		const localAppData = env.LOCALAPPDATA || join(home, "AppData", "Local");
		return join(localAppData, "tunelo", "tunelo.exe");
	}
	return join(home, ".local", "bin", "tunelo");
}

/** True for what `tunelo --version` of 2.x prints. */
export function isTunelo2Version(output: string): boolean {
	return /^2\.\d+\.\d+/.test(output.trim());
}

/** The installed tunelo 2.x binary, or null when there is none. */
export function findTunelo2(path: string = tunelo2Path()): string | null {
	if (!existsSync(path)) return null;
	const probe = spawnSync(path, ["--version"], {
		encoding: "utf-8",
		// A first run on Windows may wait for the antivirus scan of the binary.
		timeout: 30_000,
		windowsHide: true,
		env: { ...process.env, [FORWARDED_ENV]: "1" },
	});
	if (probe.error || probe.status !== 0) return null;
	return isTunelo2Version(probe.stdout) ? path : null;
}

/** The shell's code for a process ended by a signal: 128 + its number (SIGINT 130, SIGTERM 143). */
export function exitCodeOfSignal(signal: NodeJS.Signals | null): number {
	const number = signal ? osConstants.signals[signal] : undefined;
	return number ? 128 + number : 1;
}

/**
 * Runs `argv` with tunelo 2.x in this terminal and returns its exit code.
 * Ctrl+C reaches both processes; this one waits for 2.x to finish, so the
 * caller gets 2.x's own code.
 */
export function runTunelo2(binary: string, argv: readonly string[]): number {
	const ignore = (): void => undefined;
	process.on("SIGINT", ignore);
	process.on("SIGTERM", ignore);
	try {
		const result = spawnSync(binary, argv, {
			stdio: "inherit",
			env: { ...process.env, [FORWARDED_ENV]: "1" },
		});
		if (result.error) throw result.error;
		if (result.status !== null) return result.status;
		return exitCodeOfSignal(result.signal);
	} finally {
		process.off("SIGINT", ignore);
		process.off("SIGTERM", ignore);
	}
}
