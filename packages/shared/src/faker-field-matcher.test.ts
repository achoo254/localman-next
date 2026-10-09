import { describe, expect, it } from "vitest";
import {
	FAKER_MATCH_CONFIDENCE,
	type FakerValueKind,
	fakerValueKindOf,
	matchFakerField,
} from "./faker-field-matcher.js";
import { FAKER_FIELD_RULES } from "./faker-field-rules.js";
import { isFakerMethodId } from "./faker-method-catalog.js";
import { fakerMethodKind } from "./faker-method-kinds.js";

const { exact, edge, contains } = FAKER_MATCH_CONFIDENCE;

type Row = readonly [
	name: string,
	kind: FakerValueKind,
	method: string | null,
	confidence?: number,
];

const ENGLISH: readonly Row[] = [
	["email", "any", "internet.email", exact],
	["emailAddress", "string", "internet.email", exact],
	["userEmail", "string", "internet.email", edge],
	["useremail", "string", "internet.email", contains],
	["avatar", "any", "image.avatar", exact],
	["avatarUrl", "string", "image.avatar", exact],
	["profile_picture", "any", "image.avatar", exact],
	["imageUrl", "string", "image.url", exact],
	["coverPhoto", "any", "image.url", edge],
	["website", "string", "internet.url", exact],
	["homepageUrl", "any", "internet.url", edge],
	["username", "any", "internet.userName", exact],
	["userName", "string", "internet.userName", exact],
	["password", "string", "internet.password", exact],
	["firstName", "string", "name.firstName", exact],
	["last_name", "string", "name.lastName", exact],
	["name", "any", "name.fullName", exact],
	["fullName", "string", "name.fullName", exact],
	["customerName", "string", "name.fullName", edge],
	["productName", "any", "commerce.productName", exact],
	["companyName", "any", "company.companyName", exact],
	["fileName", "string", "system.fileName", exact],
	["jobTitle", "any", "name.jobTitle", exact],
	["phone", "string", "phone.number", exact],
	["phoneNumber", "string", "phone.number", exact],
	["mobile", "any", "phone.number", exact],
	["address", "string", "address.streetAddress", exact],
	["address_line_1", "string", "address.streetAddress", exact],
	["billingAddress", "string", "address.streetAddress", edge],
	["city", "any", "address.city", exact],
	["zipCode", "string", "address.zipCode", exact],
	["country", "any", "address.country", exact],
	["lat", "number", "address.latitude", exact],
	["longitude", "number", "address.longitude", exact],
	["createdAt", "any", "date.past", edge],
	["updated_at", "string", "date.past", edge],
	["createdAt", "number", "date.timestamp", edge],
	["publishDate", "date", "date.past", edge],
	["birthDate", "date", "date.birthdate", exact],
	["dob", "any", "date.birthdate", exact],
	["expiresAt", "any", "date.future", exact],
	["price", "string", "commerce.price", exact],
	["price", "number", "datatype.float", exact],
	["totalAmount", "number", "datatype.float", edge],
	["currency", "any", "finance.currencyCode", exact],
	["title", "any", "lorem.sentence", exact],
	["description", "string", "lorem.paragraph", exact],
	["longDescription", "string", "lorem.paragraph", edge],
	["isActive", "any", "datatype.boolean", edge],
	["emailVerified", "any", "datatype.boolean", edge],
	["uuid", "string", "datatype.uuid", exact],
	["externalId", "string", "datatype.uuid", edge],
	["externalId", "number", "datatype.number", edge],
	["ipAddress", "string", "internet.ip", exact],
	["color", "any", "color.human", exact],
	["slug", "string", "lorem.slug", exact],
	["accessToken", "string", "internet.jwt", exact],
];

const VIETNAMESE: readonly Row[] = [
	["ten", "string", "name.fullName", exact],
	["ho_ten", "string", "name.fullName", exact],
	["hoTen", "any", "name.fullName", exact],
	["ho_va_ten", "string", "name.fullName", exact],
	["ho", "string", "name.lastName", exact],
	["ten_dem", "string", "name.middleName", exact],
	["ten_khach_hang", "string", "name.fullName", edge],
	["ten_dang_nhap", "string", "internet.userName", exact],
	["mat_khau", "string", "internet.password", exact],
	["sdt", "string", "phone.number", exact],
	["so_dien_thoai", "string", "phone.number", exact],
	["soDienThoai", "any", "phone.number", exact],
	["sdt_lien_he", "string", "phone.number", edge],
	["diachi", "string", "address.streetAddress", exact],
	["dia_chi", "string", "address.streetAddress", exact],
	["diachikhachhang", "string", "address.streetAddress", contains],
	["thanh_pho", "string", "address.city", exact],
	["tinh", "string", "address.state", exact],
	["quoc_gia", "string", "address.country", exact],
	["ngay_sinh", "date", "date.birthdate", exact],
	["ngaySinh", "string", "date.birthdate", exact],
	["ngay_tao", "any", "date.past", exact],
	["ngay_dat_hang", "string", "date.past", edge],
	["gia", "number", "datatype.float", exact],
	["gia_ban", "string", "commerce.price", exact],
	["don_gia", "number", "datatype.float", exact],
	["email", "string", "internet.email", exact],
	["anh", "string", "image.url", exact],
	["hinh_anh", "string", "image.url", exact],
	["anh_dai_dien", "string", "image.avatar", exact],
	["ten_san_pham", "any", "commerce.productName", exact],
	["cong_ty", "string", "company.companyName", exact],
	["mo_ta", "string", "lorem.paragraph", exact],
	["tieu_de", "string", "lorem.sentence", exact],
	["gioi_tinh", "string", "name.sex", exact],
	["mau_sac", "string", "color.human", exact],
];

const NO_MATCH: readonly Row[] = [
	["status", "any", null],
	["role", "string", null],
	["tinh_trang", "string", null],
	["quan_ly", "string", null],
	["format", "string", null],
	["hotel", "string", null],
	["email", "number", null],
	["price", "boolean", null],
	["isActive", "number", null],
	["", "any", null],
	["__", "any", null],
];

describe("matchFakerField", () => {
	for (const [name, kind, method, confidence] of [...ENGLISH, ...VIETNAMESE]) {
		it(`${name} (${kind}) → ${method}`, () => {
			expect(matchFakerField(name, kind)).toEqual({ method, confidence });
		});
	}

	for (const [name, kind] of NO_MATCH) {
		it(`"${name}" (${kind}) → nothing`, () => {
			expect(matchFakerField(name, kind)).toBeNull();
		});
	}

	it("defaults to any type", () => {
		expect(matchFakerField("createdAt")?.method).toBe("date.past");
	});

	it("never suggests a method whose output does not fit the type", () => {
		const names = [...ENGLISH, ...VIETNAMESE].map(([name]) => name);
		const fits: Record<FakerValueKind, readonly string[]> = {
			any: [],
			string: ["string", "date"],
			number: ["number"],
			boolean: ["boolean"],
			date: ["date"],
		};
		for (const kind of ["string", "number", "boolean", "date"] as const) {
			for (const name of names) {
				const match = matchFakerField(name, kind);
				if (match === null) continue;
				expect(fits[kind], `${name} as ${kind}`).toContain(
					fakerMethodKind(match.method),
				);
			}
		}
	});

	it("caps the work on very long names", () => {
		expect(matchFakerField(`${"a".repeat(10_000)}Email`)).toBeNull();
	});
});

describe("FAKER_FIELD_RULES", () => {
	it("only uses whitelisted methods", () => {
		const methods = FAKER_FIELD_RULES.flatMap((rule) => rule.methods);
		expect(methods.filter((id) => !isFakerMethodId(id))).toEqual([]);
	});
});

describe("fakerValueKindOf", () => {
	it("maps schema field types to the kind to match", () => {
		expect(fakerValueKindOf("Faker.js")).toBe("any");
		expect(fakerValueKindOf("Number")).toBe("number");
		expect(fakerValueKindOf("Date")).toBe("date");
		expect(fakerValueKindOf("Object")).toBeNull();
		expect(fakerValueKindOf("Parent Resource")).toBeNull();
	});
});
