import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { withFileLock } from "./file-lock.js";

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tunelo-lock-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("file lock", () => {
	test("runs tasks one at a time", async () => {
		const path = join(dir, "test.lock");
		const order: string[] = [];
		const task = (name: string) =>
			withFileLock(path, async () => {
				order.push(`${name}:start`);
				await new Promise((r) => setTimeout(r, 30));
				order.push(`${name}:end`);
			});
		await Promise.all([task("a"), task("b")]);
		expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
		expect(existsSync(path)).toBe(false);
	});

	test("never removes a lock another holder took over", async () => {
		const path = join(dir, "test.lock");
		await withFileLock(path, async () => {
			// Simulate a takeover after our lock was judged stale.
			writeFileSync(path, "someone-else");
		});
		expect(readFileSync(path, "utf-8")).toBe("someone-else");
	});
});

test("creates the lock's directory when it is missing", async () => {
	const path = join(dir, "new", "session.lock");
	expect(await withFileLock(path, async () => "ran")).toBe("ran");
	expect(existsSync(path)).toBe(false);
});
