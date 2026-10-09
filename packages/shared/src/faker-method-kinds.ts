/**
 * JSON type each whitelisted Faker method returns, so the field matcher
 * only suggests methods that fit a field's type and the type exporters
 * describe Faker.js fields precisely. Zod- and Faker-free on purpose
 * (light entry point); `faker-method-kinds.test.ts` runs every runner and
 * checks its output against this table.
 */

/**
 * `date` is an ISO 8601 string, `number-array` a list of numbers and
 * `object` a small JSON object; everything else returns a string.
 */
export type FakerMethodKind =
	| "string"
	| "date"
	| "number"
	| "boolean"
	| "number-array"
	| "object";

const NON_STRING_KINDS: ReadonlyMap<string, FakerMethodKind> = new Map([
	["address.latitude", "number"],
	["address.longitude", "number"],
	["datatype.float", "number"],
	["datatype.number", "number"],
	["date.timestamp", "number"],
	["internet.httpStatusCode", "number"],
	["internet.port", "number"],
	["datatype.boolean", "boolean"],
	["datatype.datetime", "date"],
	["date.anytime", "date"],
	["date.birthdate", "date"],
	["date.future", "date"],
	["date.past", "date"],
	["date.recent", "date"],
	["date.soon", "date"],
	["address.nearbyGPSCoordinate", "number-array"],
	["color.cmyk", "number-array"],
	["color.colorByCSSColorSpace", "number-array"],
	["color.hsl", "number-array"],
	["color.hwb", "number-array"],
	["color.lab", "number-array"],
	["color.lch", "number-array"],
	["datatype.array", "number-array"],
	["science.chemicalElement", "object"],
	["science.unit", "object"],
]);

/** Kind of a whitelisted method's output; `string` for unknown ids too. */
export function fakerMethodKind(id: string): FakerMethodKind {
	return NON_STRING_KINDS.get(id) ?? "string";
}
