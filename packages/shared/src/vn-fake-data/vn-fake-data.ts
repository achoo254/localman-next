/**
 * Vietnamese fake data for testing (people, addresses, mobile numbers,
 * citizen ID numbers, companies), shared by the public API and the web
 * tool through `@localman/shared/vn-fake-data`. Pure and Faker-free: the
 * same seed gives the same records on the server and in the browser.
 * Every value is invented; none belongs to a real person or company.
 */
import { createSeededRandom } from "./seeded-random.js";
import {
	VN_FAKE_DATA_COLUMNS,
	VN_FAKE_DATA_MAX_COUNT,
	VN_FAKE_DATA_MIN_COUNT,
	type VnFakeDataLocale,
	type VnFakeDataType,
	type VnFakeRecordOf,
} from "./vn-fake-data-types.js";
import { VN_RECORD_BUILDERS } from "./vn-fake-records.js";

export {
	isVnFakeDataLocale,
	isVnFakeDataType,
	VN_FAKE_DATA_COLUMNS,
	VN_FAKE_DATA_LOCALES,
	VN_FAKE_DATA_MAX_COUNT,
	VN_FAKE_DATA_MIN_COUNT,
	VN_FAKE_DATA_TYPES,
	type VnAddress,
	type VnCccd,
	type VnCompany,
	type VnFakeDataLocale,
	type VnFakeDataType,
	type VnFakeRecord,
	type VnFakeRecordOf,
	type VnGender,
	type VnPerson,
	type VnPhone,
} from "./vn-fake-data-types.js";

export interface VnFakeDataOptions<T extends VnFakeDataType> {
	readonly type: T;
	/** VN_FAKE_DATA_MIN_COUNT to VN_FAKE_DATA_MAX_COUNT. */
	readonly count: number;
	readonly locale: VnFakeDataLocale;
	/** Same seed (and `refDate`), same records. */
	readonly seed: number;
	/** "Today" for birth dates; now when omitted. */
	readonly refDate?: Date;
}

/** `count` fake records of `type`; throws RangeError on a count out of range. */
export function generateVnFakeData<T extends VnFakeDataType>(
	options: VnFakeDataOptions<T>,
): VnFakeRecordOf[T][] {
	const { count } = options;
	if (
		!Number.isInteger(count) ||
		count < VN_FAKE_DATA_MIN_COUNT ||
		count > VN_FAKE_DATA_MAX_COUNT
	) {
		throw new RangeError(
			`count must be an integer from ${VN_FAKE_DATA_MIN_COUNT} to ${VN_FAKE_DATA_MAX_COUNT}`,
		);
	}
	const ctx = {
		random: createSeededRandom(options.seed),
		locale: options.locale,
		refDate: options.refDate ?? new Date(),
	};
	const build = VN_RECORD_BUILDERS[options.type];
	return Array.from({ length: count }, () => build(ctx));
}

function csvCell(value: unknown): string {
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Records of `type` as CSV (RFC 4180, CRLF), header row first. */
export function vnFakeDataToCsv<T extends VnFakeDataType>(
	type: T,
	records: readonly VnFakeRecordOf[T][],
): string {
	const columns = VN_FAKE_DATA_COLUMNS[type];
	const rows = records.map((record) =>
		columns.map((column) => csvCell(record[column])).join(","),
	);
	return `${[columns.join(","), ...rows].join("\r\n")}\r\n`;
}
