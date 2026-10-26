import { describe, expect, it } from "vitest";
import {
	type TuneloPackage,
	checkFile,
	findSpecifiers,
} from "./scan-imports.js";

const SERVER: TuneloPackage = {
	root: "apps/tunelo-server",
	allowedLocalman: ["@localman/tenancy"],
};
const CLI: TuneloPackage = { root: "packages/tunelo-cli", allowedLocalman: [] };

describe("findSpecifiers", () => {
	it("finds static, side-effect, dynamic, re-export and require imports", () => {
		const source = [
			'import { a } from "./a.js";',
			'import "./side-effect.js";',
			'export { b } from "@tunelo/shared";',
			'const c = await import("./c.js");',
			'const d = require("d");',
			"import {",
			"\ttype E,",
			'} from "@localman/tenancy";',
		].join("\n");
		expect(findSpecifiers(source)).toEqual([
			{ specifier: "./a.js", line: 1 },
			{ specifier: "./side-effect.js", line: 2 },
			{ specifier: "@tunelo/shared", line: 3 },
			{ specifier: "./c.js", line: 4 },
			{ specifier: "d", line: 5 },
			{ specifier: "@localman/tenancy", line: 8 },
		]);
	});
});

describe("checkFile", () => {
	it("lets the server import the tenancy guard", () => {
		const source = 'import { isServedHost } from "@localman/tenancy";';
		expect(checkFile("apps/tunelo-server/src/a.ts", source, SERVER)).toEqual(
			[],
		);
	});

	it("rejects other Localman packages, subpaths included", () => {
		const source = 'import type { X } from "@localman/shared/api-client";';
		expect(checkFile("apps/tunelo-server/src/a.ts", source, SERVER)).toEqual([
			{
				file: "apps/tunelo-server/src/a.ts",
				line: 1,
				specifier: "@localman/shared/api-client",
				reason: "apps/tunelo-server may not import @localman/shared",
			},
		]);
	});

	it("rejects tenancy in the CLI", () => {
		const source = 'import { x } from "@localman/tenancy";';
		expect(checkFile("packages/tunelo-cli/src/a.ts", source, CLI)).toHaveLength(
			1,
		);
	});

	it("rejects relative imports that leave the package", () => {
		const inside = 'import "../../src/b.js";';
		const outside = 'import "../../../../apps/api/src/x.js";';
		const file = "apps/tunelo-server/src/web/a.ts";
		expect(checkFile(file, inside, SERVER)).toEqual([]);
		expect(checkFile(file, outside, SERVER)[0]?.reason).toBe(
			"relative import leaves apps/tunelo-server",
		);
	});
});
