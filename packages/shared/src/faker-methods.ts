import { type Faker, faker as defaultFaker } from "@faker-js/faker";
import { FAKER_CATEGORIES } from "./faker-method-catalog.js";
import type { FakerRun, FakerRunnerTable } from "./faker-runner-types.js";
import { BUSINESS_RUNNERS } from "./faker-runners-business.js";
import { GENERAL_RUNNERS } from "./faker-runners-general.js";
import { PEOPLE_AND_PLACES_RUNNERS } from "./faker-runners-people-places.js";
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
