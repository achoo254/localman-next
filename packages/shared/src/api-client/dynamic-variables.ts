/**
 * Dynamic variables `{{$name}}`: a fresh value each time one is filled in.
 * `$guid`, `$timestamp`, `$isoTimestamp`, `$randomInt` and `$randomUUID`
 * are built in. The `$random…` group runs a whitelisted Faker method
 * through the caller's runner; Faker is never imported here, so the API
 * client chunk stays light. Without a runner, the few names that have a
 * small built-in generator use it and the others stay as typed.
 */
import {
	FAKER_DYNAMIC_VARIABLES,
	describeFakerVariable,
	fakerIdOf,
} from "./faker-dynamic-variables.js";

/** Runs a whitelisted Faker method by id, as text. */
export type FakerRunner = (id: string) => string;

const FULL_NAMES = [
	"Alex Morgan",
	"Linh Tran",
	"Wei Zhang",
	"Maria Garcia",
	"Minh Nguyen",
	"Sam Taylor",
];
const CITIES = ["Hanoi", "Da Nang", "Shanghai", "Berlin", "Austin", "Lyon"];
const COLORS = ["red", "teal", "violet", "orange", "olive", "navy"];

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

/** Always available, Faker or not. */
const BUILT_IN: Readonly<Record<string, () => string>> = Object.freeze({
	$guid: uuidV4,
	$randomUUID: uuidV4,
	$timestamp: () => Math.floor(Date.now() / 1000).toString(),
	$isoTimestamp: () => new Date().toISOString(),
	$randomInt: () => randomInt(0, 1000).toString(),
});

/** Stand-ins for some Faker names while no runner is given (previews). */
const WITHOUT_FAKER: Readonly<Record<string, () => string>> = Object.freeze({
	$randomEmail: () => `user${Date.now()}${randomInt(0, 999)}@example.com`,
	$randomColor: () => pick(COLORS),
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
	$randomColor: "Random colour name",
	$randomHexColor: "Random hex colour",
	$randomFullName: "Random full name",
	$randomCity: "Random city",
});

export const DYNAMIC_VARIABLE_NAMES: readonly string[] = Object.freeze([
	...Object.keys(BUILT_IN),
	...Object.keys(FAKER_DYNAMIC_VARIABLES),
]);

const KNOWN: ReadonlySet<string> = new Set(DYNAMIC_VARIABLE_NAMES);

export function isDynamicVariable(name: string): boolean {
	return KNOWN.has(name.trim());
}

/** Whether filling `name` needs a Faker runner (to load Faker first). */
export function needsFakerRunner(name: string): boolean {
	return fakerIdOf(name.trim()) !== undefined;
}

function ownResolver(
	table: Readonly<Record<string, () => string>>,
	name: string,
): (() => string) | undefined {
	return Object.hasOwn(table, name) ? table[name] : undefined;
}

/**
 * A fresh value, or `null` when there is none now: an unknown `$name`, or
 * a Faker name without `runFaker` and without a built-in stand-in.
 */
export function resolveDynamicVariable(
	name: string,
	runFaker?: FakerRunner,
): string | null {
	const trimmed = name.trim();
	const builtIn = ownResolver(BUILT_IN, trimmed);
	if (builtIn) return builtIn();
	const fakerId = fakerIdOf(trimmed);
	if (fakerId === undefined) return null;
	if (runFaker) return runFaker(fakerId);
	return ownResolver(WITHOUT_FAKER, trimmed)?.() ?? null;
}

/** English descriptions; the web app translates by name when it shows them. */
export function listDynamicVariables(): DynamicVariableInfo[] {
	return DYNAMIC_VARIABLE_NAMES.map((name) => ({
		name,
		description: DESCRIPTIONS[name] ?? describeFakerVariable(name),
	}));
}

/** Every dynamic variable (names with the `$`), for `{{` suggestions. */
export const DYNAMIC_VARIABLES: readonly DynamicVariableInfo[] = Object.freeze(
	listDynamicVariables().map((info) => Object.freeze(info)),
);
