import { Faker, base, en, vi } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { isVietnameseFieldName } from "./faker-field-locale.js";
import { fakerForField, runFakerMethod } from "./faker-methods.js";
import { VN_MOBILE_PREFIXES } from "./vn-fake-data/vn-phone.js";

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
