import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installScriptCommand, isYes } from "./cli-update-command.js";
import {
	exitCodeOfSignal,
	findTunelo2,
	isTunelo2Version,
	runTunelo2,
	tunelo2Path,
} from "./tunelo-binary.js";
import { VERSION } from "./version.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const posix = process.platform === "win32" ? it.skip : it;

describe("VERSION", () => {
	it("matches the published package.json version", () => {
		const pkg = JSON.parse(
			readFileSync(path.resolve(here, "..", "package.json"), "utf-8"),
		);
		expect(VERSION).toBe(pkg.version);
	});
});

describe("where tunelo 2.x lives", () => {
	it("is the path its install script uses on each OS", () => {
		expect(tunelo2Path("darwin", {}, "/Users/u")).toBe(
			"/Users/u/.local/bin/tunelo",
		);
		expect(
			tunelo2Path(
				"win32",
				{ LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" },
				"C:\\Users\\u",
			),
		).toBe(path.join("C:\\Users\\u\\AppData\\Local", "tunelo", "tunelo.exe"));
	});

	it("a 2.x ended by a signal exits with the shell's code for it", () => {
		expect(exitCodeOfSignal("SIGINT")).toBe(130);
		expect(exitCodeOfSignal("SIGTERM")).toBe(143);
		expect(exitCodeOfSignal(null)).toBe(1);
	});

	it("counts only a binary that says it is 2.x", () => {
		expect(isTunelo2Version("2.0.0\n")).toBe(true);
		expect(isTunelo2Version("2.13.4")).toBe(true);
		expect(isTunelo2Version("1.12.0")).toBe(false);
		expect(isTunelo2Version("")).toBe(false);
	});
});

describe("running commands with tunelo 2.x", () => {
	let dir = "";
	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), "tunelo-npm-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	function fakeBinary(version: string): string {
		const file = path.join(dir, "tunelo");
		writeFileSync(
			file,
			`#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "$@" > "${dir}/argv"\nexit 7\n`,
		);
		chmodSync(file, 0o755);
		return file;
	}

	posix("passes the same argv and returns its exit code", () => {
		const binary = findTunelo2(fakeBinary("2.0.0"));
		expect(binary).not.toBeNull();
		expect(runTunelo2(binary ?? "", ["http", "3000", "-s", "app"])).toBe(7);
		expect(readFileSync(path.join(dir, "argv"), "utf-8").trim()).toBe(
			"http 3000 -s app",
		);
	});

	posix("ignores another tunelo at that path (this 1.x package again)", () => {
		expect(findTunelo2(fakeBinary("1.12.0"))).toBeNull();
		expect(findTunelo2(path.join(dir, "missing"))).toBeNull();
	});
});

describe("tunelo update without 2.x", () => {
	it("runs the install script of each OS, and none elsewhere", () => {
		expect(installScriptCommand("darwin")).toEqual({
			command: "/bin/sh",
			args: [
				"-c",
				"curl -fsSL https://chat.hoandat.com/agent/install.sh | sh -s -- en",
			],
		});
		expect(installScriptCommand("win32")?.args.at(-1)).toBe(
			"& ([scriptblock]::Create((irm https://chat.hoandat.com/agent/install.ps1))) en",
		);
		expect(installScriptCommand("linux")).toBeNull();
	});

	it("removes the npm package only on an explicit yes", () => {
		for (const yes of ["y", "Y", "yes", " YES "]) expect(isYes(yes)).toBe(true);
		for (const no of ["", "n", "no", "maybe"]) expect(isYes(no)).toBe(false);
	});
});
