import type { SeededRandom } from "./seeded-random.js";
import type { VnGender } from "./vn-fake-data-types.js";

export interface VnCccdProvince {
	readonly code: string;
	readonly name: string;
}

/**
 * Province codes that open a citizen ID card number (CCCD): the place of
 * birth registration, one code per province of the 63-province map
 * (Circular 07/2016/TT-BCA). Cards issued before the 2025 merger keep
 * them, so they are the codes real numbers carry.
 */
export const VN_CCCD_PROVINCES: readonly VnCccdProvince[] = [
	["001", "Hà Nội"],
	["002", "Hà Giang"],
	["004", "Cao Bằng"],
	["006", "Bắc Kạn"],
	["008", "Tuyên Quang"],
	["010", "Lào Cai"],
	["011", "Điện Biên"],
	["012", "Lai Châu"],
	["014", "Sơn La"],
	["015", "Yên Bái"],
	["017", "Hòa Bình"],
	["019", "Thái Nguyên"],
	["020", "Lạng Sơn"],
	["022", "Quảng Ninh"],
	["024", "Bắc Giang"],
	["025", "Phú Thọ"],
	["026", "Vĩnh Phúc"],
	["027", "Bắc Ninh"],
	["030", "Hải Dương"],
	["031", "Hải Phòng"],
	["033", "Hưng Yên"],
	["034", "Thái Bình"],
	["035", "Hà Nam"],
	["036", "Nam Định"],
	["037", "Ninh Bình"],
	["038", "Thanh Hóa"],
	["040", "Nghệ An"],
	["042", "Hà Tĩnh"],
	["044", "Quảng Bình"],
	["045", "Quảng Trị"],
	["046", "Thừa Thiên Huế"],
	["048", "Đà Nẵng"],
	["049", "Quảng Nam"],
	["051", "Quảng Ngãi"],
	["052", "Bình Định"],
	["054", "Phú Yên"],
	["056", "Khánh Hòa"],
	["058", "Ninh Thuận"],
	["060", "Bình Thuận"],
	["062", "Kon Tum"],
	["064", "Gia Lai"],
	["066", "Đắk Lắk"],
	["067", "Đắk Nông"],
	["068", "Lâm Đồng"],
	["070", "Bình Phước"],
	["072", "Tây Ninh"],
	["074", "Bình Dương"],
	["075", "Đồng Nai"],
	["077", "Bà Rịa - Vũng Tàu"],
	["079", "Hồ Chí Minh"],
	["080", "Long An"],
	["082", "Tiền Giang"],
	["083", "Bến Tre"],
	["084", "Trà Vinh"],
	["086", "Vĩnh Long"],
	["087", "Đồng Tháp"],
	["089", "An Giang"],
	["091", "Kiên Giang"],
	["092", "Cần Thơ"],
	["093", "Hậu Giang"],
	["094", "Sóc Trăng"],
	["095", "Bạc Liêu"],
	["096", "Cà Mau"],
].map(([code = "", name = ""]) => ({ code, name }));

/**
 * Fourth digit of a CCCD: the century of birth and the gender. Even for
 * men, odd for women; 0/1 for 1900–1999, 2/3 for 2000–2099 and so on up
 * to 8/9 for 2300–2399.
 */
export function cccdCenturyGenderDigit(
	birthYear: number,
	gender: VnGender,
): number {
	const century = Math.floor(birthYear / 100) - 19;
	if (century < 0 || century > 4) {
		throw new RangeError(`No CCCD century digit for year ${birthYear}`);
	}
	return century * 2 + (gender === "female" ? 1 : 0);
}

/**
 * A fake 12-digit CCCD: a real province code, the century/gender digit,
 * the last two digits of the birth year and six random digits. The
 * number follows the public format only; it names no real person.
 */
export function fakeVnCccd(
	random: SeededRandom,
	holder: { gender: VnGender; birthYear: number },
): { number: string; province: VnCccdProvince } {
	const province = random.pick(VN_CCCD_PROVINCES);
	const century = cccdCenturyGenderDigit(holder.birthYear, holder.gender);
	const year = String(holder.birthYear % 100).padStart(2, "0");
	return {
		number: `${province.code}${century}${year}${random.digits(6)}`,
		province,
	};
}
