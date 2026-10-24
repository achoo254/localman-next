import { describe, expect, it } from "vitest";
import { VN_CCCD_PROVINCES, cccdCenturyGenderDigit } from "./vn-cccd.js";
import {
	VN_FAKE_DATA_COLUMNS,
	VN_FAKE_DATA_TYPES,
	type VnGender,
	generateVnFakeData,
	vnFakeDataToCsv,
} from "./vn-fake-data.js";
import { VN_MOBILE_PREFIXES } from "./vn-phone.js";
import { VN_PROVINCES } from "./vn-places-data.js";

const REF_DATE = new Date("2026-10-24T00:00:00Z");
const PROVINCE_CODES = new Set(VN_CCCD_PROVINCES.map((p) => p.code));
const PREFIXES = new Set(VN_MOBILE_PREFIXES);

function generate<T extends (typeof VN_FAKE_DATA_TYPES)[number]>(
	type: T,
	seed = 42,
	locale: "vi" | "en" = "vi",
) {
	return generateVnFakeData({
		type,
		count: 50,
		locale,
		seed,
		refDate: REF_DATE,
	});
}

/** What the digits of a CCCD say about its holder. */
function decodeCccd(number: string) {
	const digit = Number(number[3]);
	const gender: VnGender = digit % 2 === 0 ? "male" : "female";
	return {
		provinceCode: number.slice(0, 3),
		gender,
		century: 1900 + Math.floor(digit / 2) * 100,
		yearOfCentury: Number(number.slice(4, 6)),
	};
}

describe("CCCD", () => {
	it("lists the 63 real province codes, three digits each", () => {
		expect(PROVINCE_CODES.size).toBe(63);
		for (const code of PROVINCE_CODES) expect(code).toMatch(/^\d{3}$/);
		expect(PROVINCE_CODES.has("001")).toBe(true);
		expect(PROVINCE_CODES.has("079")).toBe(true);
		expect(PROVINCE_CODES.has("003")).toBe(false);
	});

	it("encodes century and gender in the fourth digit", () => {
		expect(cccdCenturyGenderDigit(1990, "male")).toBe(0);
		expect(cccdCenturyGenderDigit(1990, "female")).toBe(1);
		expect(cccdCenturyGenderDigit(2005, "male")).toBe(2);
		expect(cccdCenturyGenderDigit(2005, "female")).toBe(3);
		expect(() => cccdCenturyGenderDigit(1899, "male")).toThrow(RangeError);
	});

	it("has 12 digits, a real province code and the holder's gender and year", () => {
		for (const record of generate("cccd")) {
			expect(record.number).toMatch(/^\d{12}$/);
			const decoded = decodeCccd(record.number);
			expect(PROVINCE_CODES.has(decoded.provinceCode)).toBe(true);
			expect(decoded.provinceCode).toBe(record.provinceCode);
			expect(decoded.gender).toBe(record.gender);
			expect(decoded.century + decoded.yearOfCentury).toBe(record.birthYear);
		}
	});

	it("matches the person it was generated with", () => {
		for (const person of generate("person")) {
			const decoded = decodeCccd(person.cccd);
			expect(person.cccd).toMatch(/^\d{12}$/);
			expect(decoded.gender).toBe(person.gender);
			expect(decoded.century + decoded.yearOfCentury).toBe(
				Number(person.dateOfBirth.slice(0, 4)),
			);
		}
	});
});

describe("people", () => {
	it("are 18 to 70 years old on the reference date", () => {
		for (const person of generate("person", 7)) {
			expect(person.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			const born = Date.parse(`${person.dateOfBirth}T00:00:00Z`);
			expect(born).toBeLessThanOrEqual(Date.parse("2008-10-24T00:00:00Z"));
			expect(born).toBeGreaterThan(Date.parse("1955-10-24T00:00:00Z"));
		}
	});

	it("drop diacritics in English", () => {
		const names = generate("person", 3, "en").map((p) => p.fullName);
		for (const name of names) expect(name).toMatch(/^[A-Za-z ]+$/);
		expect(
			generate("person", 3, "vi").some((p) => /[^\x20-\x7e]/.test(p.fullName)),
		).toBe(true);
	});
});

describe("phones", () => {
	it("are 10 digits on a mobile prefix in use, +84 internationally", () => {
		for (const phone of generate("phone")) {
			expect(phone.number).toMatch(/^0\d{9}$/);
			expect(PREFIXES.has(phone.number.slice(0, 3))).toBe(true);
			expect(phone.international).toBe(`+84${phone.number.slice(1)}`);
			expect(phone.carrier).not.toBe("");
		}
	});

	it("never use a retired or landline prefix", () => {
		for (const prefix of ["030", "031", "024", "028", "095", "080"]) {
			expect(PREFIXES.has(prefix)).toBe(false);
		}
	});
});

describe("addresses and companies", () => {
	it("cover the 34 provinces of the two-level map", () => {
		expect(VN_PROVINCES).toHaveLength(34);
		const names = new Set(VN_PROVINCES.map((p) => p.name));
		expect(names.size).toBe(34);
		for (const place of VN_PROVINCES)
			expect(place.wards.length).toBeGreaterThan(0);
	});

	it("name a ward and a province, in either locale", () => {
		const [vi] = generateVnFakeData({
			type: "address",
			count: 1,
			locale: "vi",
			seed: 5,
		});
		expect(vi?.ward).toMatch(/^Phường /);
		expect(vi?.full).toBe(`${vi?.street}, ${vi?.ward}, ${vi?.province}`);
		const [en] = generateVnFakeData({
			type: "address",
			count: 1,
			locale: "en",
			seed: 5,
		});
		expect(en?.ward).toMatch(/ Ward$/);
		expect(en?.province).toMatch(/ (City|Province)$/);
	});

	it("give companies a 10-digit tax code and a valid phone", () => {
		for (const company of generate("company")) {
			expect(company.taxCode).toMatch(/^\d{10}$/);
			expect(PREFIXES.has(company.phone.slice(0, 3))).toBe(true);
			expect(company.name).toMatch(/^Công ty /);
		}
	});
});

describe("generateVnFakeData", () => {
	it("gives the same records for the same seed and different ones otherwise", () => {
		for (const type of VN_FAKE_DATA_TYPES) {
			expect(generate(type, 123)).toEqual(generate(type, 123));
			expect(generate(type, 123)).not.toEqual(generate(type, 124));
		}
	});

	it("returns records with exactly the columns of their type", () => {
		for (const type of VN_FAKE_DATA_TYPES) {
			for (const record of generate(type)) {
				expect(Object.keys(record)).toEqual(VN_FAKE_DATA_COLUMNS[type]);
			}
		}
	});

	it("refuses a count out of 1..50", () => {
		for (const count of [0, 51, 1.5, Number.NaN]) {
			expect(() =>
				generateVnFakeData({ type: "phone", count, locale: "vi", seed: 1 }),
			).toThrow(RangeError);
		}
	});
});

describe("vnFakeDataToCsv", () => {
	it("writes a header and quotes cells holding commas or quotes", () => {
		const csv = vnFakeDataToCsv("address", [
			{
				street: '1 "A"',
				ward: "Phường B",
				province: "Tỉnh C",
				full: "1, B, C",
			},
		]);
		expect(csv).toBe(
			'street,ward,province,full\r\n"1 ""A""",Phường B,Tỉnh C,"1, B, C"\r\n',
		);
	});
});
