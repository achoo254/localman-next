/**
 * Shapes of the Vietnamese fake data shared by the public API and the web
 * tool. Records are flat (strings and numbers only), so a table, a CSV
 * row and a JSON object show the same thing. Object types, not
 * interfaces, so a record is also a `Record<string, string | number>`.
 */
export const VN_FAKE_DATA_TYPES = [
	"person",
	"address",
	"phone",
	"cccd",
	"company",
] as const;
export type VnFakeDataType = (typeof VN_FAKE_DATA_TYPES)[number];

/** `vi`: Vietnamese text with diacritics; `en`: without, English labels. */
export const VN_FAKE_DATA_LOCALES = ["vi", "en"] as const;
export type VnFakeDataLocale = (typeof VN_FAKE_DATA_LOCALES)[number];

export const VN_FAKE_DATA_MIN_COUNT = 1;
export const VN_FAKE_DATA_MAX_COUNT = 50;

export type VnGender = "male" | "female";

/** A person; `cccd` matches the gender and birth year. */
export type VnPerson = {
	fullName: string;
	gender: VnGender;
	/** `YYYY-MM-DD`. */
	dateOfBirth: string;
	cccd: string;
};

export type VnAddress = {
	street: string;
	ward: string;
	province: string;
	full: string;
};

export type VnPhone = {
	/** National form, 10 digits: `0912345678`. */
	number: string;
	/** `+84912345678`. */
	international: string;
	carrier: string;
};

/** A fake citizen ID card number (CCCD) and what its digits encode. */
export type VnCccd = {
	number: string;
	provinceCode: string;
	province: string;
	gender: VnGender;
	birthYear: number;
};

export type VnCompany = {
	name: string;
	/** 10 digits, random: not a registered tax code. */
	taxCode: string;
	address: string;
	phone: string;
};

export interface VnFakeRecordOf {
	person: VnPerson;
	address: VnAddress;
	phone: VnPhone;
	cccd: VnCccd;
	company: VnCompany;
}

export type VnFakeRecord = VnFakeRecordOf[VnFakeDataType];

/** Column order of each type: table headers, CSV header, JSON keys. */
export const VN_FAKE_DATA_COLUMNS: {
	readonly [T in VnFakeDataType]: readonly (keyof VnFakeRecordOf[T])[];
} = {
	person: ["fullName", "gender", "dateOfBirth", "cccd"],
	address: ["street", "ward", "province", "full"],
	phone: ["number", "international", "carrier"],
	cccd: ["number", "provinceCode", "province", "gender", "birthYear"],
	company: ["name", "taxCode", "address", "phone"],
};

export function isVnFakeDataType(value: unknown): value is VnFakeDataType {
	return VN_FAKE_DATA_TYPES.some((type) => type === value);
}

export function isVnFakeDataLocale(value: unknown): value is VnFakeDataLocale {
	return VN_FAKE_DATA_LOCALES.some((locale) => locale === value);
}
