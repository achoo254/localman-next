import { readFileSync } from "node:fs";
import { Faker, base, en } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import {
	FAKER_CATEGORIES,
	FAKER_METHOD_GROUPS,
	FAKER_METHOD_IDS,
	isFakerMethodId,
} from "./faker-method-catalog.js";
import { fakerMethodMaxBytes } from "./faker-method-sizes.js";
import { FAKER_METHODS, runFakerMethod } from "./faker-methods.js";

const RUNNER_SOURCES = [
	"faker-methods.ts",
	"faker-runners-business.ts",
	"faker-runners-general.ts",
	"faker-runners-people-places.ts",
].map((file) => ({
	file,
	source: readFileSync(new URL(`./${file}`, import.meta.url), "utf8"),
}));

const seeded = (seed: number): Faker => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(seed);
	return faker;
};

describe("Faker whitelist", () => {
	it("covers the 21 source categories with about 250 methods", () => {
		expect(FAKER_CATEGORIES).toHaveLength(21);
		expect(FAKER_METHOD_GROUPS.map((group) => group.category)).toEqual([
			...FAKER_CATEGORIES,
		]);
		expect(FAKER_METHOD_IDS.length).toBeGreaterThanOrEqual(240);
		expect(new Set(FAKER_METHOD_IDS).size).toBe(FAKER_METHOD_IDS.length);
	});

	it("has exactly one runner per catalog id", () => {
		const runnerIds = FAKER_METHODS.map((method) => method.id);
		expect(new Set(runnerIds).size).toBe(runnerIds.length);
		expect([...runnerIds].sort()).toEqual([...FAKER_METHOD_IDS].sort());
	});

	it("returns JSON for every method (dates as ISO strings)", () => {
		const faker = seeded(42);
		for (const id of FAKER_METHOD_IDS) {
			const value = runFakerMethod(id, faker);
			expect(value, id).not.toBeUndefined();
			expect(JSON.parse(JSON.stringify(value)), id).toEqual(value);
		}
		expect(runFakerMethod("date.past", faker)).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
	});

	it("is reproducible with a seeded Faker", () => {
		expect(runFakerMethod("name.fullName", seeded(7))).toBe(
			runFakerMethod("name.fullName", seeded(7)),
		);
	});

	it("finds nothing for ids outside the whitelist", () => {
		const unknown = [
			"",
			"constructor",
			"__proto__",
			"toString",
			"helpers.fake",
			"helpers.mustache",
			"name.__proto__",
			"name.constructor",
			"address.toString",
			"location.city",
			"name.fullName ",
			"NAME.FULLNAME",
		];
		for (const id of unknown) {
			expect(runFakerMethod(id), id).toBeUndefined();
			expect(isFakerMethodId(id), id).toBe(false);
		}
		expect(isFakerMethodId("name.fullName")).toBe(true);
	});

	it("calls Faker statically: no fake(), eval or computed member access", () => {
		for (const { file, source } of RUNNER_SOURCES) {
			expect(source, file).not.toMatch(/helpers\.fake\b/);
			expect(source, file).not.toMatch(/\beval\s*\(/);
			expect(source, file).not.toMatch(/\bFunction\s*\(/);
			// `faker[x]`, `f[x]` or `f.module[x]`: a lookup by a runtime name.
			expect(source, file).not.toMatch(/\b(?:f|faker)(?:\.\w+)?\s*\[/);
		}
	});
	it("stays within the size bound of every method", () => {
		const faker = seeded(0);
		for (const id of FAKER_METHOD_IDS) {
			let largest = 0;
			for (let seed = 0; seed < 300; seed += 1) {
				faker.seed(seed * 7919 + 13);
				const json = JSON.stringify(runFakerMethod(id, faker));
				largest = Math.max(largest, Buffer.byteLength(json));
			}
			expect(largest, id).toBeLessThanOrEqual(fakerMethodMaxBytes(id));
		}
		// 300 seeds of every method: this bounds sizes, not speed.
	}, 30_000);
});
