import { Faker, base, en, vi } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { isVietnameseFieldName } from "./faker-field-locale.js";
import { fakerForField, runFakerMethod } from "./faker-methods.js";
import {
	VN_JOB_DEPARTMENTS,
	VN_JOB_ROLES,
} from "./vn-fake-data/vn-job-data.js";
import { VN_MIDDLE_NAMES } from "./vn-fake-data/vn-names-data.js";
import { VN_MOBILE_PREFIXES } from "./vn-fake-data/vn-phone.js";
import { VN_PROVINCES, VN_STREETS } from "./vn-fake-data/vn-places-data.js";

const seeded = (seed = 1): Faker => {
	const faker = new Faker({ locale: [en, base] });
	faker.seed(seed);
	return faker;
};

describe("isVietnameseFieldName", () => {
	it("knows Vietnamese names however they are written", () => {
		for (const name of [
			"ten",
			"ho_ten",
			"hoTen",
			"sdt",
			"so_dien_thoai",
			"soDienThoai",
			"dia_chi",
			"diaChiGiaoHang",
			"ten_cong_ty",
			"ngay_sinh",
		]) {
			expect(isVietnameseFieldName(name), name).toBe(true);
		}
	});

	it("leaves English names, and words merely containing one, in English", () => {
		for (const name of [
			"name",
			"fullName",
			"phone",
			"address",
			"tenant",
			"content",
			"photo",
			"email",
		]) {
			expect(isVietnameseFieldName(name), name).toBe(false);
		}
	});
});

describe("fakerForField", () => {
	it("returns the given Faker for an English name", () => {
		const faker = seeded();
		expect(fakerForField("fullName", faker)).toBe(faker);
	});

	it("gives Vietnamese names family name first for a Vietnamese field", () => {
		const families = new Set(vi.person?.last_name?.generic ?? []);
		const faker = seeded();
		for (let i = 0; i < 20; i += 1) {
			const name = runFakerMethod(
				"name.fullName",
				fakerForField("ho_ten", faker),
			);
			expect(families.has(String(name).split(" ")[0] ?? "")).toBe(true);
		}
	});

	it("gives Vietnamese mobile numbers on prefixes in use for sdt", () => {
		const faker = seeded();
		for (let i = 0; i < 20; i += 1) {
			const phone = String(
				runFakerMethod("phone.number", fakerForField("sdt", faker)),
			);
			expect(phone).toMatch(/^0\d{9}$/);
			expect(VN_MOBILE_PREFIXES).toContain(phone.slice(0, 3));
		}
		const international = runFakerMethod(
			"phone.numberInternational",
			fakerForField("so_dien_thoai", faker),
		);
		expect(String(international)).toMatch(/^\+84[35789]\d{8}$/);
	});

	it("stays reproducible with a seeded Faker", () => {
		const run = () => {
			const faker = seeded(7);
			return [1, 2, 3].map(() =>
				runFakerMethod(
					"address.streetAddress",
					fakerForField("dia_chi", faker),
				),
			);
		};
		expect(run()).toEqual(run());
	});
});

/** `count` values of `method` for the Vietnamese field `field`. */
function valuesOf(field: string, method: string, count = 50): string[] {
	const faker = seeded(3);
	return Array.from({ length: count }, () =>
		String(runFakerMethod(method, fakerForField(field, faker))),
	);
}

/** Words of Faker's English data that must never reach a Vietnamese field. */
const englishWords = (...lists: (readonly string[] | null | undefined)[]) =>
	new Set(lists.flatMap((list) => list ?? []).flatMap((x) => x.split(" ")));

describe("fakerForField places and jobs", () => {
	const provinces = new Set(VN_PROVINCES.map((place) => place.name));

	it("writes dia_chi as a house number and a Vietnamese street", () => {
		const suffixes = englishWords(en.location?.street_suffix);
		const streets = new Set(VN_STREETS);
		for (const address of valuesOf("dia_chi", "address.streetAddress")) {
			const match = /^(\d+(?:\/\d+)?) (.+)$/.exec(address);
			expect(match, address).not.toBeNull();
			expect(streets.has(match?.[2] ?? ""), address).toBe(true);
			for (const word of address.split(" ")) {
				expect(suffixes.has(word), address).toBe(false);
			}
		}
	});

	it("takes thanh_pho from the 6 cities and tinh from the 28 provinces", () => {
		const cities = valuesOf("thanh_pho", "address.city");
		const states = valuesOf("tinh", "address.state");
		const kindOf = new Map(VN_PROVINCES.map((p) => [p.name, p.kind]));
		for (const place of cities) expect(kindOf.get(place), place).toBe("city");
		for (const place of states) {
			expect(kindOf.get(place), place).toBe("province");
		}
		// Old-map names and Faker's English spellings never show.
		for (const old of ["Haiphong", "Hanoi", "Quảng Bình", "Đắk Nông"]) {
			expect([...cities, ...states]).not.toContain(old);
		}
	});

	it("gives a full address on the new map", () => {
		for (const full of valuesOf("dia_chi", "address.fullAddress")) {
			const province = full.split(", ").at(-1) ?? "";
			expect(provinces.has(province), full).toBe(true);
		}
	});

	it("titles chuc_vu and nghe_nghiep in Vietnamese", () => {
		const english = englishWords(
			en.person?.job_descriptor,
			en.person?.job_area,
			en.person?.job_type,
		);
		for (const field of ["chuc_vu", "nghe_nghiep"]) {
			for (const title of valuesOf(field, "name.jobTitle")) {
				const role = VN_JOB_ROLES.find((r) => title.startsWith(`${r} `));
				expect(role, title).toBeDefined();
				const department = title.slice((role ?? "").length + 1);
				expect(VN_JOB_DEPARTMENTS, title).toContain(department);
				for (const word of title.split(" ")) {
					expect(english.has(word), title).toBe(false);
				}
			}
		}
	});

	it("keeps gioi_tinh and ten_dem Vietnamese", () => {
		for (const sex of valuesOf("gioi_tinh", "name.sex")) {
			expect(["Nam", "Nữ"]).toContain(sex);
		}
		const middles = [...VN_MIDDLE_NAMES.male, ...VN_MIDDLE_NAMES.female];
		for (const middle of valuesOf("ten_dem", "name.middleName")) {
			expect(middles).toContain(middle);
		}
	});
});
