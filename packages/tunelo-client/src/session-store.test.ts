import {
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writePrivateFile } from "./session-store.js";

describe("writePrivateFile", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "tunelo-session-store-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("writes the content, creating missing folders, and leaves no temp file", () => {
		const path = join(dir, "nested", "session.json");
		writePrivateFile(path, "first\n");
		writePrivateFile(path, "second\n");
		expect(readFileSync(path, "utf8")).toBe("second\n");
		expect(readdirSync(join(dir, "nested"))).toEqual(["session.json"]);
	});

	it.skipIf(process.platform === "win32")("keeps the file owner-only", () => {
		const path = join(dir, "session.json");
		writePrivateFile(path, "token\n");
		expect(statSync(path).mode & 0o777).toBe(0o600);
	});
});
