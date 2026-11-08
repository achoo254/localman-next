import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { breakStaleLock, withFileLock } from "./file-lock.js";

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

describe("breaking a stale lock", () => {
	const old = new Date(Date.now() - 60_000);

	test("removes a lock whose holder stopped touching it", () => {
		const path = join(dir, "s.lock");
		writeFileSync(path, "crashed");
		utimesSync(path, old, old);
		breakStaleLock(path, "me");
		expect(existsSync(path)).toBe(false);
		expect(existsSync(`${path}.break`)).toBe(false);
	});

	test("never removes a lock taken after it was judged stale", () => {
		// Another waiter broke the stale lock and took a fresh one meanwhile.
		const path = join(dir, "s.lock");
		writeFileSync(path, "fresh-holder");
		breakStaleLock(path, "slow-waiter");
		expect(readFileSync(path, "utf-8")).toBe("fresh-holder");
	});

	test("leaves the lock alone while another waiter is breaking it", () => {
		const path = join(dir, "s.lock");
		writeFileSync(path, "crashed");
		utimesSync(path, old, old);
		writeFileSync(`${path}.break`, "other-waiter");
		breakStaleLock(path, "me");
		expect(readFileSync(path, "utf-8")).toBe("crashed");
		expect(readFileSync(`${path}.break`, "utf-8")).toBe("other-waiter");
	});

	test("a breaker that crashed does not block forever", () => {
		const path = join(dir, "s.lock");
		writeFileSync(path, "crashed");
		utimesSync(path, old, old);
		writeFileSync(`${path}.break`, "crashed-breaker");
		utimesSync(`${path}.break`, old, old);
		breakStaleLock(path, "me");
		expect(existsSync(path)).toBe(false);
	});

	test("waiters behind a stale lock still run one at a time", async () => {
		const path = join(dir, "s.lock");
		writeFileSync(path, "crashed");
		utimesSync(path, old, old);
		let inside = 0;
		let overlap = false;
		const task = () =>
			withFileLock(path, async () => {
				inside++;
				if (inside > 1) overlap = true;
				await new Promise((r) => setTimeout(r, 20));
				inside--;
			});
		await Promise.all([task(), task(), task()]);
		expect(overlap).toBe(false);
	});
});
