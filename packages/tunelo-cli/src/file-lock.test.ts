import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { withFileLock } from "./file-lock.js";
import { useTempHome } from "./test-support/temp-home.js";

const home = useTempHome();

describe("file lock", () => {
	test("runs tasks one at a time", async () => {
		const path = join(home.dir(), "test.lock");
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
		const path = join(home.dir(), "test.lock");
		await withFileLock(path, async () => {
			// Simulate a takeover after our lock was judged stale.
			writeFileSync(path, "someone-else");
		});
		expect(readFileSync(path, "utf-8")).toBe("someone-else");
	});
});
