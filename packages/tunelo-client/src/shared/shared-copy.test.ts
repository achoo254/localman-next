import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SHARED_FILES, copyHeader } from "./shared-files.js";

const here = dirname(fileURLToPath(import.meta.url));
const originals = resolve(here, "../../../tunelo-shared/src");

describe("copied protocol sources", () => {
	test.each(SHARED_FILES)("%s matches @tunelo/shared", (name) => {
		const copy = readFileSync(resolve(here, name), "utf-8");
		const original = readFileSync(resolve(originals, name), "utf-8");
		expect(
			copy,
			"run `pnpm --filter @tunelo/client sync:shared` after changing @tunelo/shared",
		).toBe(`${copyHeader(name)}${original}`);
	});
});
