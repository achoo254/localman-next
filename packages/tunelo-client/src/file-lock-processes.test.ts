import { spawn } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";

const BUILT = pathToFileURL(
	resolve(dirname(fileURLToPath(import.meta.url)), "../dist/file-lock.js"),
).href;

/** Takes the lock, logs `start`/`end` around a short task, exits. */
const CHILD = `
import { appendFileSync } from "node:fs";
const [lockPath, logPath, built] = process.argv.slice(1);
const { withFileLock } = await import(built);
await withFileLock(lockPath, async () => {
	appendFileSync(logPath, "start\\n");
	await new Promise((r) => setTimeout(r, 40));
	appendFileSync(logPath, "end\\n");
});
`;

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tunelo-lock-procs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function runChild(lockPath: string, logPath: string): Promise<number> {
	return new Promise((done, fail) => {
		const child = spawn(
			process.execPath,
			["--input-type=module", "-e", CHILD, lockPath, logPath, BUILT],
			{ stdio: "ignore" },
		);
		child.on("error", fail);
		child.on("exit", (code) => done(code ?? -1));
	});
}

test("processes behind a crashed holder's lock run one at a time", async () => {
	const lockPath = join(dir, "session.lock");
	const logPath = join(dir, "log");
	writeFileSync(logPath, "");
	// A holder and a breaker that both crashed long ago.
	const old = new Date(Date.now() - 120_000);
	writeFileSync(lockPath, "crashed");
	utimesSync(lockPath, old, old);
	writeFileSync(`${lockPath}.break`, "crashed-breaker");
	utimesSync(`${lockPath}.break`, old, old);

	const codes = await Promise.all(
		Array.from({ length: 5 }, () => runChild(lockPath, logPath)),
	);
	expect(codes).toEqual([0, 0, 0, 0, 0]);
	const lines = readFileSync(logPath, "utf-8").trim().split("\n");
	expect(lines).toEqual(
		Array.from({ length: 5 }, () => ["start", "end"]).flat(),
	);
}, 30_000);
