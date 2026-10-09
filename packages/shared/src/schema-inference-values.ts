/**
 * Field shapes guessed from sample values (`schema-inference.ts`): ISO
 * dates, e-mails, URLs and UUIDs among strings, a common shape across the
 * records of a column, and the typing of CSV cells. Every pattern is
 * anchored and checked only on strings below a length cap.
 */
import { type JsonValue, isJsonObject } from "./json-value.js";
import type { ImportParams } from "./schema-import-errors.js";
import type { ImportedKind, ImportedShape } from "./schema-import-fields.js";
import type { Sample } from "./schema-inference-records.js";

const ISO_DATE =
	/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const URL_TEXT = /^https?:\/\/[^\s]+$/i;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
/** `12`, `-3.5`, `1e6`; not `007` (codes, phone numbers stay text). */
const CSV_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const CSV_BOOLEAN = /^(?:true|false)$/i;
const MAX_EMAIL_LENGTH = 254;
const MAX_URL_LENGTH = 2048;

/** Shape of one string: a date, or text with the format it looks like. */
export function classifyString(text: string): ImportedShape {
	if (
		text.length <= 40 &&
		ISO_DATE.test(text) &&
		!Number.isNaN(Date.parse(text))
	) {
		return { kind: "date" };
	}
	if (text.length <= MAX_EMAIL_LENGTH && EMAIL.test(text)) {
		return { kind: "string", format: "email" };
	}
	if (text.length <= MAX_URL_LENGTH && URL_TEXT.test(text)) {
		return { kind: "string", format: "url" };
	}
	if (UUID.test(text)) return { kind: "string", format: "uuid" };
	return { kind: "string" };
}

function shapeOfValue(value: JsonValue): ImportedShape {
	if (typeof value === "string") return classifyString(value);
	if (typeof value === "number") return { kind: "number" };
	if (typeof value === "boolean") return { kind: "boolean" };
	return { kind: Array.isArray(value) ? "array" : "object" };
}

/** Why a guessed shape is a fallback; the caller adds `field` to params. */
export interface ShapeNote {
	readonly code: "MIXED_TYPES" | "EMPTY_VALUES";
	readonly message: string;
	readonly params: ImportParams;
}

export interface GuessedShape {
	readonly shape: ImportedShape;
	/** For a warning; `null` when the shape is not a fallback. */
	readonly note: ShapeNote | null;
}

/** The shape every non-null value of a column agrees on, or String. */
export function shapeOfValues(values: readonly JsonValue[]): GuessedShape {
	const present = values.filter((value) => value !== null);
	if (present.length === 0) {
		return {
			shape: { kind: "string" },
			note: {
				code: "EMPTY_VALUES",
				message: "Only null or missing values; imported as String",
				params: { as: "String" },
			},
		};
	}
	const shapes = present.map(shapeOfValue);
	const kinds = new Set<ImportedKind>(shapes.map((shape) => shape.kind));
	if (kinds.size > 1) {
		return {
			shape: { kind: "string" },
			note: {
				code: "MIXED_TYPES",
				message: `Mixed types (${[...kinds].join(", ")}); imported as String`,
				params: { types: [...kinds].join(", ") },
			},
		};
	}
	const [first] = shapes;
	const kind = first?.kind ?? "string";
	if (kind === "string") {
		const formats = new Set(shapes.map((shape) => shape.format));
		const format = formats.size === 1 ? first?.format : undefined;
		return {
			shape: format === undefined ? { kind } : { kind, format },
			note: null,
		};
	}
	const allEmpty =
		kind === "array" &&
		present.every((value) => Array.isArray(value) && value.length === 0);
	return {
		shape: { kind },
		note: allEmpty
			? {
					code: "EMPTY_VALUES",
					message: "Only empty arrays; imported as Array",
					params: { as: "Array" },
				}
			: null,
	};
}

/**
 * Every key of the samples, in order of first appearance, with its values
 * in the first `limit` samples. One pass, so work follows the input size.
 */
export function columnsOf(
	samples: readonly Sample[],
	limit: number,
	keys: readonly string[],
): Map<string, JsonValue[]> {
	const columns = new Map<string, JsonValue[]>(keys.map((key) => [key, []]));
	samples.forEach(({ record }, index) => {
		for (const [key, value] of Object.entries(record)) {
			let values = columns.get(key);
			if (values === undefined) {
				values = [];
				columns.set(key, values);
			}
			if (index < limit) values.push(value);
		}
	});
	return columns;
}

/** Arrays (or null) only, holding objects only, at least one of them. */
export function isObjectList(values: readonly JsonValue[]): boolean {
	let objects = 0;
	for (const value of values) {
		if (value === null) continue;
		if (!Array.isArray(value) || !value.every(isJsonObject)) return false;
		objects += value.length;
	}
	return objects > 0;
}

export type CsvKind = "number" | "boolean" | "text";

const isCsvNumber = (cell: string): boolean => {
	if (!CSV_NUMBER.test(cell)) return false;
	const value = Number(cell);
	// Integers past 2^53 would lose digits: keep them as text.
	return (
		Number.isFinite(value) &&
		(/[.eE]/.test(cell) || Number.isSafeInteger(value))
	);
};

/** Number or boolean when every non-empty cell is one, else text. */
export function csvColumnKind(cells: readonly string[]): CsvKind {
	const filled = cells.filter((cell) => cell !== "");
	if (filled.length === 0) return "text";
	if (filled.every(isCsvNumber)) return "number";
	return filled.every((cell) => CSV_BOOLEAN.test(cell)) ? "boolean" : "text";
}

/** A cell as a record value: empty is `null`; a cell off its kind stays text. */
export function csvCellValue(cell: string, kind: CsvKind): JsonValue {
	if (cell === "") return null;
	if (kind === "number" && isCsvNumber(cell)) return Number(cell);
	if (kind === "boolean" && CSV_BOOLEAN.test(cell)) {
		return cell.toLowerCase() === "true";
	}
	return cell;
}
