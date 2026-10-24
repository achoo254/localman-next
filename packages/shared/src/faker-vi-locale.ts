import { type LocaleDefinition, base, en, vi } from "@faker-js/faker";
import {
	VN_JOB_DEPARTMENTS,
	VN_JOB_LEVELS,
	VN_JOB_ROLES,
} from "./vn-fake-data/vn-job-data.js";
import { VN_MIDDLE_NAMES } from "./vn-fake-data/vn-names-data.js";
import { VN_MOBILE_PREFIXES } from "./vn-fake-data/vn-phone.js";
import { VN_PROVINCES, VN_STREETS } from "./vn-fake-data/vn-places-data.js";

/** Names of the places of one kind, as people write them. */
const namesOf = (kind: "city" | "province"): string[] =>
	VN_PROVINCES.filter((place) => place.kind === kind).map(
		(place) => place.name,
	);

/** `thanh_pho` asks for a city, `tinh` for a province: keep them apart. */
const CITY_NAMES = namesOf("city");
const PROVINCE_NAMES = namesOf("province");

/** Every sample ward once, "Phường …" as in an address. */
const WARDS = [...new Set(VN_PROVINCES.flatMap((place) => place.wards))].map(
	(ward) => `Phường ${ward}`,
);

/**
 * Faker's `vi` locale fixed where Vietnamese-named fields (`ho_ten`, `sdt`,
 * `dia_chi`, `tinh`, `chuc_vu`…) meet its gaps, so they never come out in
 * English or on the old map:
 *
 * - names family first (Faker's pattern is "given family"), middle names
 *   and `sex` ("Nam"/"Nữ") Vietnamese;
 * - mobile numbers on prefixes in use (Faker's include landlines and
 *   retired prefixes);
 * - places from `vn-places-data.ts`: Vietnamese streets without English
 *   suffixes ("12 Lê Lợi", not "7809 Tô Inlet"), the 6 centrally run cities
 *   for `city` and the 28 provinces for `state`, on the map since 1 July
 *   2025 ("Hải Phòng", not "Haiphong"; "Quảng Trị", not "Quảng Bình"),
 *   sample wards for `county` (districts are gone);
 * - job titles "role department" from `vn-job-data.ts` (`vi` has none).
 *
 * English still fills what no Vietnamese field asks for (internet,
 * lorem…).
 */
export const VI_LOCALE: LocaleDefinition[] = [
	{
		person: {
			name: [{ value: "{{person.lastName}} {{person.firstName}}", weight: 1 }],
			middle_name: {
				female: [...VN_MIDDLE_NAMES.female],
				male: [...VN_MIDDLE_NAMES.male],
			},
			sex: ["Nữ", "Nam"],
			job_title_pattern: ["{{person.jobType}} {{person.jobArea}}"],
			job_type: [...VN_JOB_ROLES],
			job_area: [...VN_JOB_DEPARTMENTS],
			job_descriptor: [...VN_JOB_LEVELS],
		},
		phone_number: {
			format: {
				human: VN_MOBILE_PREFIXES.map((prefix) => `${prefix}#######`),
				national: VN_MOBILE_PREFIXES.map((prefix) => `${prefix}#######`),
				international: VN_MOBILE_PREFIXES.map(
					(prefix) => `+84${prefix.slice(1)}#######`,
				),
			},
		},
		location: {
			building_number: ["#", "##", "###", "##/#"],
			street_name: [...VN_STREETS],
			street_pattern: ["{{location.street_name}}"],
			street_address: {
				normal: "{{location.buildingNumber}} {{location.street}}",
				full: "{{location.buildingNumber}} {{location.street}}, {{location.city}}",
			},
			city_name: CITY_NAMES,
			city_pattern: ["{{location.city_name}}"],
			state: PROVINCE_NAMES,
			// Vietnam has no customary short forms of province names.
			state_abbr: PROVINCE_NAMES,
			county: WARDS,
		},
	},
	vi,
	en,
	base,
];
