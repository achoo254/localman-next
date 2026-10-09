/**
 * Faker method suggested for an imported field, from its OpenAPI `format`
 * or its name (`faker-field-matcher.ts`). Only methods whose output fits
 * the declared type are suggested, and only close name matches: an
 * import should not turn a plain field into Faker on a weak guess.
 * Anything unmatched stays a plain String/Number/Date field.
 */
import {
	FAKER_MATCH_CONFIDENCE,
	type FakerValueKind,
	matchFakerField,
} from "./faker-field-matcher.js";
import type { ImportedKind, ImportedShape } from "./schema-import-fields.js";

/** A Map, so formats such as `__proto__` cannot reach `Object.prototype`. */
const FORMAT_HINTS: ReadonlyMap<string, string> = new Map([
	["email", "internet.email"],
	["idn-email", "internet.email"],
	["uri", "internet.url"],
	["url", "internet.url"],
	["uri-reference", "internet.url"],
	["uuid", "datatype.uuid"],
	["hostname", "internet.domainName"],
	["ipv4", "internet.ipv4"],
	["ipv6", "internet.ipv6"],
	["password", "internet.password"],
]);

/** Imported kinds a Faker method may replace; others keep their plain type. */
const MATCH_KINDS: Partial<Record<ImportedKind, FakerValueKind>> = {
	string: "string",
	number: "number",
	date: "date",
};

/**
 * Methods that only fill a field of that type at random. The plain type
 * already does that (a Date field generates `date.past`), and a number
 * method could put decimals in an integer field, so they do not turn a
 * plain field into Faker. A string `updatedAt` still gets `date.past`.
 */
const GENERIC_FILLERS: Partial<Record<FakerValueKind, readonly string[]>> = {
	date: ["date.past"],
	number: ["datatype.float", "datatype.number"],
};

/** A whitelisted `category.method`, or `null` to keep the plain type. */
export function fakerHintFor(
	name: string,
	shape: ImportedShape,
): string | null {
	const kind = MATCH_KINDS[shape.kind];
	if (kind === undefined) return null;
	if (kind === "string") {
		const byFormat = FORMAT_HINTS.get(shape.format ?? "");
		if (byFormat !== undefined) return byFormat;
	}
	const match = matchFakerField(name, kind);
	if (match === null || match.confidence < FAKER_MATCH_CONFIDENCE.edge) {
		return null;
	}
	const fillers = GENERIC_FILLERS[kind] ?? [];
	return fillers.includes(match.method) ? null : match.method;
}
