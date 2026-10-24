import type { SeededRandom } from "./seeded-random.js";
import type { VnPhone } from "./vn-fake-data-types.js";

export interface VnMobileCarrier {
	readonly name: string;
	/** Three-digit national prefixes, leading `0` included. */
	readonly prefixes: readonly string[];
}

/**
 * Mobile prefixes in use since the 2018 switch from 11 to 10 digits. A
 * number is a prefix plus 7 digits.
 */
export const VN_MOBILE_CARRIERS: readonly VnMobileCarrier[] = [
	{
		name: "Viettel",
		prefixes: [
			"032",
			"033",
			"034",
			"035",
			"036",
			"037",
			"038",
			"039",
			"086",
			"096",
			"097",
			"098",
		],
	},
	{
		name: "VinaPhone",
		prefixes: ["081", "082", "083", "084", "085", "088", "091", "094"],
	},
	{
		name: "MobiFone",
		prefixes: ["070", "076", "077", "078", "079", "089", "090", "093"],
	},
	{ name: "Vietnamobile", prefixes: ["052", "056", "058", "092"] },
	{ name: "Gmobile", prefixes: ["059", "099"] },
	{ name: "Itelecom", prefixes: ["087"] },
	{ name: "Reddi", prefixes: ["055"] },
];

export const VN_MOBILE_PREFIXES: readonly string[] = VN_MOBILE_CARRIERS.flatMap(
	(carrier) => carrier.prefixes,
);

const PREFIX_CARRIERS = VN_MOBILE_CARRIERS.flatMap((carrier) =>
	carrier.prefixes.map((prefix) => ({ prefix, carrier: carrier.name })),
);

/** A 10-digit mobile number on a prefix in use; no real subscriber meant. */
export function fakeVnPhone(random: SeededRandom): VnPhone {
	const { prefix, carrier } = random.pick(PREFIX_CARRIERS);
	const number = `${prefix}${random.digits(7)}`;
	return { number, international: `+84${number.slice(1)}`, carrier };
}
