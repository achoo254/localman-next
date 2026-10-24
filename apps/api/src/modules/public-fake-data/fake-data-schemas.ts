import {
	VN_FAKE_DATA_LOCALES,
	VN_FAKE_DATA_MAX_COUNT,
	VN_FAKE_DATA_MIN_COUNT,
	VN_FAKE_DATA_TYPES,
} from "@localman/shared/vn-fake-data";
import { z } from "zod";

/** What every answer says about its data, in the body itself. */
export const FAKE_DATA_NOTICE =
	"Fake data for testing only. Every value is invented at random: no real person, address, phone subscriber, ID card or company is meant.";

export const fakeDataInput = z.object({
	type: z.enum(VN_FAKE_DATA_TYPES).default("person"),
	count: z
		.number()
		.int()
		.min(VN_FAKE_DATA_MIN_COUNT)
		.max(VN_FAKE_DATA_MAX_COUNT)
		.default(10),
	locale: z.enum(VN_FAKE_DATA_LOCALES).default("vi"),
});

const gender = z.enum(["male", "female"]);

const person = z.object({
	fullName: z.string(),
	gender,
	dateOfBirth: z.string(),
	cccd: z.string(),
});

const address = z.object({
	street: z.string(),
	ward: z.string(),
	province: z.string(),
	full: z.string(),
});

const phone = z.object({
	number: z.string(),
	international: z.string(),
	carrier: z.string(),
});

const cccd = z.object({
	number: z.string(),
	provinceCode: z.string(),
	province: z.string(),
	gender,
	birthYear: z.number().int(),
});

const company = z.object({
	name: z.string(),
	taxCode: z.string(),
	address: z.string(),
	phone: z.string(),
});

export const fakeDataView = z.object({
	/** Always true: a client can tell test data from real data. */
	fake: z.literal(true),
	notice: z.string(),
	type: z.enum(VN_FAKE_DATA_TYPES),
	locale: z.enum(VN_FAKE_DATA_LOCALES),
	items: z.array(z.union([person, address, phone, cccd, company])),
});
