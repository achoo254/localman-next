/**
 * Builders of one Vietnamese fake record per type, all drawing from one
 * seeded random source so a seed gives the same list everywhere.
 */
import type { SeededRandom } from "./seeded-random.js";
import { fakeVnCccd } from "./vn-cccd.js";
import {
	VN_COMPANY_FORMS,
	VN_COMPANY_TRADES,
	VN_COMPANY_WORDS,
} from "./vn-company-data.js";
import type {
	VnAddress,
	VnCccd,
	VnCompany,
	VnFakeDataLocale,
	VnFakeDataType,
	VnFakeRecordOf,
	VnGender,
	VnPerson,
} from "./vn-fake-data-types.js";
import {
	VN_FAMILY_NAMES,
	VN_GIVEN_NAMES,
	VN_MIDDLE_NAMES,
} from "./vn-names-data.js";
import { fakeVnPhone } from "./vn-phone.js";
import { VN_PROVINCES, VN_STREETS } from "./vn-places-data.js";
import { withoutDiacritics } from "./vn-text.js";

export interface RecordContext {
	readonly random: SeededRandom;
	readonly locale: VnFakeDataLocale;
	/** "Today" for ages: birth dates make people 18 to 70 years old. */
	readonly refDate: Date;
}

const MIN_AGE = 18;
const MAX_AGE = 70;
const DAY_MS = 86_400_000;

/** Vietnamese text as is for `vi`, without diacritics for `en`. */
function localText(ctx: RecordContext, text: string): string {
	return ctx.locale === "vi" ? text : withoutDiacritics(text);
}

function randomGender(ctx: RecordContext): VnGender {
	return ctx.random.next() < 0.5 ? "male" : "female";
}

/** `YYYY-MM-DD` of someone aged MIN_AGE to MAX_AGE on `refDate` (UTC). */
function birthDate(ctx: RecordContext): string {
	const ref = ctx.refDate;
	const yearsBefore = (years: number) =>
		Date.UTC(ref.getUTCFullYear() - years, ref.getUTCMonth(), ref.getUTCDate());
	const latest = yearsBefore(MIN_AGE);
	const earliest = yearsBefore(MAX_AGE + 1) + DAY_MS;
	const day = ctx.random.int(0, Math.floor((latest - earliest) / DAY_MS));
	return new Date(earliest + day * DAY_MS).toISOString().slice(0, 10);
}

const yearOf = (isoDate: string): number => Number(isoDate.slice(0, 4));

function person(ctx: RecordContext): VnPerson {
	const gender = randomGender(ctx);
	const family = ctx.random.weighted(VN_FAMILY_NAMES).name;
	const middle = ctx.random.pick(VN_MIDDLE_NAMES[gender]);
	const given = ctx.random.pick(VN_GIVEN_NAMES[gender]);
	const dateOfBirth = birthDate(ctx);
	const cccd = fakeVnCccd(ctx.random, {
		gender,
		birthYear: yearOf(dateOfBirth),
	});
	return {
		fullName: localText(ctx, `${family} ${middle} ${given}`),
		gender,
		dateOfBirth,
		cccd: cccd.number,
	};
}

function address(ctx: RecordContext): VnAddress {
	const place = ctx.random.pick(VN_PROVINCES);
	const ward = localText(ctx, ctx.random.pick(place.wards));
	const street = localText(ctx, ctx.random.pick(VN_STREETS));
	const house = String(ctx.random.int(1, 499));
	const name = localText(ctx, place.name);
	const city = place.kind === "city";
	const parts =
		ctx.locale === "vi"
			? {
					street: `${house} ${street}`,
					ward: `Phường ${ward}`,
					province: `${city ? "Thành phố" : "Tỉnh"} ${name}`,
				}
			: {
					street: `${house} ${street} Street`,
					ward: `${ward} Ward`,
					province: `${name} ${city ? "City" : "Province"}`,
				};
	return {
		...parts,
		full: [parts.street, parts.ward, parts.province].join(", "),
	};
}

function cccd(ctx: RecordContext): VnCccd {
	const gender = randomGender(ctx);
	const birthYear = yearOf(birthDate(ctx));
	const { number, province } = fakeVnCccd(ctx.random, { gender, birthYear });
	return {
		number,
		provinceCode: province.code,
		province: localText(ctx, province.name),
		gender,
		birthYear,
	};
}

function company(ctx: RecordContext): VnCompany {
	const form = ctx.random.pick(VN_COMPANY_FORMS);
	const trade = ctx.random.pick(VN_COMPANY_TRADES);
	const first = ctx.random.pick(VN_COMPANY_WORDS);
	const second = ctx.random.pick(
		VN_COMPANY_WORDS.filter((word) => word !== first),
	);
	const brand = localText(ctx, `${first} ${second}`);
	return {
		name:
			ctx.locale === "vi"
				? `${form.vi} ${trade.vi} ${brand}`
				: `${brand} ${trade.en} ${form.en}`,
		taxCode: `0${ctx.random.digits(9)}`,
		address: address(ctx).full,
		phone: fakeVnPhone(ctx.random).number,
	};
}

export const VN_RECORD_BUILDERS: {
	readonly [T in VnFakeDataType]: (ctx: RecordContext) => VnFakeRecordOf[T];
} = {
	person,
	address,
	phone: (ctx) => fakeVnPhone(ctx.random),
	cccd,
	company,
};
