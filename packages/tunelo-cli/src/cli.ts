#!/usr/bin/env node
/**
 * Tunelo 1.12, the last release of this npm package. Every command now runs
 * in tunelo 2.x, the one Tunelo process on the machine: this package hands
 * the command line to it unchanged and exits with its code. Without 2.x it
 * only installs it (`tunelo update`) or says how.
 */
import { TUNELO_INSTALL_COMMANDS } from "@tunelo/shared";
import { runUpdate } from "./cli-update-command.js";
import { FORWARDED_ENV, findTunelo2, runTunelo2 } from "./tunelo-binary.js";
import { VERSION } from "./version.js";

function installHint(): string {
	return [
		"  Tunelo now runs as tunelo 2.x; this npm package (1.x) only starts it.",
		"  Install tunelo 2.x with `tunelo update`, or:",
		`    macOS:   ${TUNELO_INSTALL_COMMANDS.macos}`,
		`    Windows: ${TUNELO_INSTALL_COMMANDS.windows}`,
		"  Your sign-in and settings in ~/.tunelo carry over.",
	].join("\n");
}

async function main(argv: string[]): Promise<number> {
	// Started by tunelo 2.x: never hand the command back to it.
	const binary = process.env[FORWARDED_ENV] ? null : findTunelo2();
	if (binary) return runTunelo2(binary, argv);
	const [command] = argv;
	if (command === "--version" || command === "-V") {
		console.log(VERSION);
		return 0;
	}
	if (command === "update") return runUpdate();
	console.error(installHint());
	return 1;
}

main(process.argv.slice(2)).then(
	(code) => process.exit(code),
	(err: Error) => {
		console.error(`  tunelo: ${err.message}`);
		process.exit(1);
	},
);
