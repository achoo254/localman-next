/**
 * Dynamic variables `{{$name}}`: a fresh value each time one is filled in.
 * No Faker here, so the API client chunk stays light.
 */

const FULL_NAMES = [
	"Alex Morgan",
	"Linh Tran",
	"Wei Zhang",
	"Maria Garcia",
	"Minh Nguyen",
	"Sam Taylor",
];
const CITIES = ["Hanoi", "Da Nang", "Shanghai", "Berlin", "Austin", "Lyon"];

function randomInt(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(items: readonly string[]): string {
	return items[randomInt(0, items.length - 1)] ?? "";
}

/**
 * RFC 4122 v4 from `getRandomValues`, which (unlike `randomUUID`) also
 * exists on pages served over plain http, such as a LAN dev server.
 */
export function uuidV4(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const RESOLVERS: Readonly<Record<string, () => string>> = Object.freeze({
	$guid: uuidV4,
	$randomUUID: uuidV4,
	$timestamp: () => Math.floor(Date.now() / 1000).toString(),
	$isoTimestamp: () => new Date().toISOString(),
	$randomInt: () => randomInt(0, 1000).toString(),
	$randomEmail: () => `user${Date.now()}${randomInt(0, 999)}@example.com`,
	$randomColor: () =>
		`#${randomInt(0, 0xffffff).toString(16).padStart(6, "0")}`,
	$randomFullName: () => pick(FULL_NAMES),
	$randomCity: () => pick(CITIES),
});

export interface DynamicVariableInfo {
	name: string;
	description: string;
}

const DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
	$guid: "A v4 UUID",
	$randomUUID: "A v4 UUID",
	$timestamp: "Current Unix timestamp in seconds",
	$isoTimestamp: "Current ISO 8601 timestamp",
	$randomInt: "Random integer from 0 to 1000",
	$randomEmail: "Random email address",
	$randomColor: "Random hex colour",
	$randomFullName: "Random full name",
	$randomCity: "Random city",
});

export const DYNAMIC_VARIABLE_NAMES: readonly string[] = Object.freeze(
	Object.keys(RESOLVERS),
);

export function isDynamicVariable(name: string): boolean {
	return Object.hasOwn(RESOLVERS, name.trim());
}

/** A fresh value, or `null` for an unknown `$name`. */
export function resolveDynamicVariable(name: string): string | null {
	const trimmed = name.trim();
	const resolver = Object.hasOwn(RESOLVERS, trimmed)
		? RESOLVERS[trimmed]
		: undefined;
	return resolver ? resolver() : null;
}

/** English descriptions; the web app translates by name when it shows them. */
export function listDynamicVariables(): DynamicVariableInfo[] {
	return DYNAMIC_VARIABLE_NAMES.map((name) => ({
		name,
		description: DESCRIPTIONS[name] ?? name,
	}));
}
