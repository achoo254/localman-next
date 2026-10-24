import { Faker, faker as defaultFaker } from "@faker-js/faker";
import { isVietnameseFieldName } from "./faker-field-locale.js";
import { FAKER_CATEGORIES } from "./faker-method-catalog.js";
import type { FakerRun, FakerRunnerTable } from "./faker-runner-types.js";
import { BUSINESS_RUNNERS } from "./faker-runners-business.js";
import { GENERAL_RUNNERS } from "./faker-runners-general.js";
import { PEOPLE_AND_PLACES_RUNNERS } from "./faker-runners-people-places.js";
import { VI_LOCALE } from "./faker-vi-locale.js";
import type { JsonValue } from "./json-value.js";

/**
 * The executable Faker whitelist. Imported through the
 * `@localman/shared/faker-methods` entry (never from the package index) so
 * only server code loads Faker.
 */
export interface FakerMethod {
	/** `category.method`, e.g. `name.fullName`. */
	readonly id: string;
	readonly run: FakerRun;
}

const TABLES: readonly FakerRunnerTable[] = [
	PEOPLE_AND_PLACES_RUNNERS,
	BUSINESS_RUNNERS,
	GENERAL_RUNNERS,
];

function collectMethods(): FakerMethod[] {
	const methods: FakerMethod[] = [];
	for (const category of FAKER_CATEGORIES) {
		for (const table of TABLES) {
			const runners = table[category];
			if (!runners) continue;
			for (const [name, run] of Object.entries(runners)) {
				methods.push(Object.freeze({ id: `${category}.${name}`, run }));
			}
		}
	}
	return methods;
}

/** Every runnable method, grouped by category. */
export const FAKER_METHODS: readonly FakerMethod[] = Object.freeze(
	collectMethods(),
);

/** A `Map`, so ids such as `constructor` or `__proto__` find nothing. */
const RUNNERS: ReadonlyMap<string, FakerRun> = new Map(
	FAKER_METHODS.map((method) => [method.id, method.run]),
);

/**
 * Runs a whitelisted method; `undefined` when `id` is not in the
 * whitelist. Pass a seeded `Faker` for reproducible output.
 */
export function runFakerMethod(
	id: string,
	faker: Faker = defaultFaker,
): JsonValue | undefined {
	return RUNNERS.get(id)?.(faker);
}

/**
 * A whitelisted method's value as text, for `{{$random…}}`: strings as
 * they are, numbers and booleans printed, arrays and objects as JSON;
 * `""` when `id` is not in the whitelist.
 */
export function runFakerMethodText(
	id: string,
	faker: Faker = defaultFaker,
): string {
	const value = runFakerMethod(id, faker);
	if (value === undefined || value === null) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/** One Vietnamese Faker per base Faker, made on first use. */
const viFakers = new WeakMap<Faker, Faker>();

/**
 * The Faker to fill a field with: `faker` itself, or for a Vietnamese
 * field name (`ho_ten`, `sdt`, `dia_chi`) a `vi` Faker reseeded from
 * `faker`, so a seeded `faker` still gives reproducible values. Use the
 * result at once: the next call for the same `faker` reseeds it.
 */
export function fakerForField(
	fieldName: string,
	faker: Faker = defaultFaker,
): Faker {
	if (!isVietnameseFieldName(fieldName)) return faker;
	let viFaker = viFakers.get(faker);
	if (!viFaker) {
		viFaker = new Faker({ locale: VI_LOCALE });
		viFakers.set(faker, viFaker);
	}
	viFaker.seed(faker.number.int());
	return viFaker;
}
