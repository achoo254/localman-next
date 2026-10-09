/**
 * CSV to sample objects for `inferFromSamples`: the header row names the
 * fields, the first `CSV_TYPE_ROWS` rows decide whether a column holds
 * numbers or booleans, and rows with missing or extra cells are reported.
 */
import { parseCsv } from "./csv-parser.js";
import { FORBIDDEN_KEYS, type JsonValue } from "./json-value.js";
import {
	MAX_RECORDS_PER_RESOURCE,
	MAX_SCHEMA_FIELDS,
} from "./resource-constants.js";
import { SchemaImportFailure, paramText } from "./schema-import-errors.js";
import type { InferenceContext } from "./schema-inference-context.js";
import { inferFromSamples } from "./schema-inference-json.js";
import { csvCellValue, csvColumnKind } from "./schema-inference-values.js";

/** Rows read to guess column types. */
export const CSV_TYPE_ROWS = 100;
/** Rows reported one by one for a wrong cell count; the rest are counted. */
const REPORTED_ROWS = 5;
const FORBIDDEN: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);
/** Schema fields plus `id`: more columns could never become fields. */
const MAX_COLUMNS = MAX_SCHEMA_FIELDS + 1;

interface Column {
	readonly index: number;
	readonly name: string;
}

/** Header cells kept as columns: named, allowed and not repeated. */
function columnsOf(
	ctx: InferenceContext,
	resource: string,
	header: readonly string[],
): Column[] {
	const columns: Column[] = [];
	const seen = new Set<string>();
	header.forEach((cell, index) => {
		const name = cell.trim() || `column${index + 1}`;
		const path = `${resource}.${name}`;
		const skipped = { path: paramText(name) };
		if (FORBIDDEN.has(name)) {
			ctx.warn(
				path,
				"SKIPPED",
				`Column "${name}" is not allowed; skipped`,
				skipped,
			);
		} else if (seen.has(name)) {
			ctx.warn(
				path,
				"SKIPPED",
				`Column "${name}" appears twice; skipped`,
				skipped,
			);
		} else if (columns.length >= MAX_COLUMNS) {
			ctx.warn(
				path,
				"TOO_MANY_FIELDS",
				`Only the first ${MAX_COLUMNS} columns are read; skipped`,
				{ max: MAX_SCHEMA_FIELDS },
			);
		} else {
			seen.add(name);
			columns.push({ index, name });
		}
	});
	return columns;
}

/** Adds the resource of the CSV `text`, one record per data row, to `ctx`. */
export function inferFromCsv(
	ctx: InferenceContext,
	text: string,
	rootName: string,
): void {
	if (text.includes("\uFFFD") || text.includes("\0")) {
		throw new SchemaImportFailure(
			"ENCODING",
			"The CSV is not UTF-8 text (it holds replacement or NUL characters)",
		);
	}
	ctx.reserve();
	const resource = ctx.resourceName(rootName);
	// The header and the most records a resource holds.
	const parsed = parseCsv(text, MAX_RECORDS_PER_RESOURCE + 1);
	const [header, ...rows] = parsed.rows;
	if (header === undefined) {
		throw new SchemaImportFailure("CSV_EMPTY", "The CSV is empty");
	}
	if (parsed.truncated) {
		ctx.warn(
			resource,
			"TOO_MANY_RECORDS",
			`Only the first ${MAX_RECORDS_PER_RESOURCE} rows were read`,
			{ max: MAX_RECORDS_PER_RESOURCE },
		);
	}
	const columns = columnsOf(ctx, resource, header);
	const typeRows = rows.slice(0, CSV_TYPE_ROWS);
	const kinds = columns.map(({ index }) =>
		csvColumnKind(typeRows.map((row) => row[index] ?? "")),
	);
	let misshapen = 0;
	rows.forEach((row, index) => {
		if (row.length === header.length) return;
		misshapen += 1;
		if (misshapen <= REPORTED_ROWS) {
			const issue =
				row.length < header.length
					? "missing cells are empty"
					: "extra cells are ignored";
			ctx.warn(
				resource,
				"CSV_ROW_CELLS",
				`Row ${index + 1} has ${row.length} cells instead of ${header.length}; ${issue}`,
				{ row: index + 1, found: row.length, expected: header.length },
			);
		}
	});
	if (misshapen > REPORTED_ROWS) {
		const count = misshapen - REPORTED_ROWS;
		ctx.warn(
			resource,
			"CSV_MORE_ROWS",
			`${count} more rows have a wrong number of cells`,
			{ count },
		);
	}
	const samples = rows.map((row) => {
		const entries: [string, JsonValue][] = columns.map(({ index, name }, i) => [
			name,
			csvCellValue(row[index] ?? "", kinds[i] ?? "text"),
		]);
		return { record: Object.fromEntries(entries), parentId: null };
	});
	inferFromSamples(
		ctx,
		{
			name: resource,
			parentName: null,
			samples,
			keys: columns.map(({ name }) => name),
			depth: 1,
		},
		CSV_TYPE_ROWS,
	);
}
