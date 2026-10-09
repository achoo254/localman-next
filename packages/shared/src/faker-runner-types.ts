import type { Faker } from "@faker-js/faker";
import type { FakerCategory } from "./faker-method-catalog.js";
import type { JsonValue } from "./json-value.js";

/**
 * Calls one Faker method with fixed arguments. Runners must return JSON
 * (dates as ISO strings, bigints as strings) and must call Faker
 * statically: no `faker[name]` lookups and no `faker.helpers.fake`.
 */
export type FakerRun = (faker: Faker) => JsonValue;

/** Runners by category, then by method name. */
export type FakerRunnerTable = Partial<
	Readonly<Record<FakerCategory, Readonly<Record<string, FakerRun>>>>
>;
