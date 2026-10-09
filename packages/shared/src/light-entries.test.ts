// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as constants from "./constants.js";
import * as root from "./index.js";

const IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm;

/** Every module specifier reachable from `file` through relative imports. */
function reachable(file: string, seen = new Set<string>()): Set<string> {
	if (seen.has(file)) return seen;
	seen.add(file);
	const source = readFileSync(new URL(file, import.meta.url), "utf8");
	for (const [, specifier = ""] of source.matchAll(IMPORT)) {
		if (specifier.startsWith("./")) {
			reachable(specifier.replace(/\.js$/, ".ts"), seen);
		} else {
			seen.add(specifier);
		}
	}
	return seen;
}

describe("light entry points", () => {
	it.each(["./constants.ts", "./faker-method-catalog.ts"])(
		"%s pulls in neither zod nor Faker",
		(entry) => {
			const modules = [...reachable(entry)];
			expect(modules.filter((m) => !m.startsWith("./"))).toEqual([]);
			expect(modules).not.toContain("./resource-schema.ts");
			expect(fileURLToPath(new URL(entry, import.meta.url))).toMatch(/\.ts$/);
		},
	);

	it("exports the same values as the package root", () => {
		for (const [name, value] of Object.entries(constants)) {
			expect(root[name as keyof typeof root], name).toBe(value);
		}
	});
});
