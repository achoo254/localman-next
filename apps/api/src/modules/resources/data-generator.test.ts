import { Faker, base, en, vi } from "@faker-js/faker";
import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { generateRecords } from "./data-generator.js";
import { prepareRecords } from "./record-input.js";

const seeded = (): Faker => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(1);
	// Dates are relative to "now": pin it so two runs match.
	faker.setDefaultRefDate("2026-01-01T00:00:00.000Z");
	return faker;
};

const REF = { id: "r1", name: "items" };

const SCHEMA = [
	{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
	{ name: "label", type: "String" },
	{ name: "n", type: "Number" },
	{ name: "flag", type: "Boolean" },
	{ name: "obj", type: "Object" },
	{ name: "list", type: "Array" },
	{ name: "at", type: "Date" },
	{ name: "owner", type: "Parent Resource" },
	{ name: "kids", type: "Child Resource", childId: "a".repeat(24) },
] as const;

describe("generateRecords", () => {
	it("fills each field type and skips relation fields", () => {
		const [first, second] = generateRecords(
			{ schema: SCHEMA, template: null, parentKey: null, resource: REF },
			2,
			null,
			seeded(),
		);
		expect(first?.id).toBe("1");
		expect(first?.parentRecordId).toBeNull();
		expect(first?.data).toMatchObject({
			label: "label 1",
			n: 1,
			obj: {},
			list: [],
		});
		expect(second?.data).toMatchObject({ label: "label 2", n: 2 });
		expect(typeof first?.data.name).toBe("string");
		expect(typeof first?.data.flag).toBe("boolean");
		expect(first?.data.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(Object.keys(first?.data ?? {})).not.toContain("owner");
		expect(Object.keys(first?.data ?? {})).not.toContain("kids");
	});

	it("is reproducible with a seeded Faker", () => {
		const spec = {
			schema: SCHEMA,
			template: null,
			parentKey: null,
			resource: REF,
		};
		expect(generateRecords(spec, 3, null, seeded())).toEqual(
			generateRecords(spec, 3, null, seeded()),
		);
	});

	it("fills Vietnamese-named fields from Faker's vi locale, family name first", () => {
		const spec = {
			schema: [
				{ name: "ho_ten", type: "Faker.js", fakerMethod: "name.fullName" },
				{ name: "fullName", type: "Faker.js", fakerMethod: "name.fullName" },
			] as const,
			template: null,
			parentKey: null,
			resource: REF,
		};
		const families = new Set(vi.person?.last_name?.generic ?? []);
		const firstWord = (value: unknown) => String(value).split(" ")[0] ?? "";
		const records = generateRecords(spec, 20, null, seeded());
		for (const { data } of records) {
			expect(families.has(firstWord(data.ho_ten))).toBe(true);
		}
		expect(
			records.every(({ data }) => families.has(firstWord(data.fullName))),
		).toBe(false);
		expect(generateRecords(spec, 20, null, seeded())).toEqual(records);
	});

	it("spreads children over the parent records and needs at least one", () => {
		const spec = {
			schema: [],
			template: null,
			parentKey: "userId",
			resource: REF,
		};
		const records = generateRecords(spec, 100, ["1", "2", "3"], seeded());
		const used = new Set(records.map((r) => r.parentRecordId));
		expect([...used].sort()).toEqual(["1", "2", "3"]);
		expect(() => generateRecords(spec, 1, [], seeded())).toThrow(
			OperationError,
		);
		expect(generateRecords(spec, 0, [], seeded())).toEqual([]);
	});

	it("renders the template and never lets it set id or the parent id", () => {
		const [record] = generateRecords(
			{
				schema: SCHEMA,
				template: { id: "x", userId: "y", tag: "$word.noun", raw: "$nope" },
				parentKey: "userId",
				resource: REF,
			},
			1,
			["9"],
			seeded(),
		);
		expect(record?.id).toBe("1");
		expect(record?.parentRecordId).toBe("9");
		expect(Object.keys(record?.data ?? {})).toEqual(["tag", "raw"]);
		expect(record?.data.raw).toBe("$nope");
	});
});

describe("prepareRecords", () => {
	it("numbers missing ids after the highest numeric id", () => {
		const { records, nextId } = prepareRecords(
			[{ id: "10" }, {}, { id: "z" }, {}],
			{ parentKey: null, parentRecordIds: null, resource: REF },
		);
		expect(records.map((r) => r.id)).toEqual(["10", "11", "z", "12"]);
		expect(nextId).toBe(13);
	});

	it("reports every problem at once with its path", () => {
		const attempt = () =>
			prepareRecords([null, { id: "a" }, { id: "a" }, { userId: "7" }], {
				parentKey: "userId",
				parentRecordIds: ["1"],
				resource: REF,
			});
		expect(attempt).toThrow(OperationError);
		let details: unknown;
		try {
			attempt();
		} catch (error) {
			if (error instanceof OperationError) details = error.details;
		}
		expect(details).toEqual([
			{ path: "data.0", message: "must be a JSON object" },
			{ path: "data.2.id", message: 'duplicate id "a"' },
			{
				path: "data.3.userId",
				message: "must be the id of an existing parent record",
			},
		]);
	});
});
