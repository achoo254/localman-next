/**
 * RFC 4180 CSV reader for the resource import: comma separator, a leading
 * byte-order mark ignored, quoted cells holding commas and line breaks,
 * `""` as an escaped quote, `\r\n`, `\n` or `\r` line ends. Blank lines are
 * skipped. One pass over the text, so work grows with the input size only;
 * reading stops after `maxRows` rows so a long file does not fill memory.
 */
import { SchemaImportFailure } from "./schema-import-errors.js";

const QUOTE = 34;
const COMMA = 44;
const LF = 10;
const CR = 13;

export interface CsvRows {
	/** Rows of cells, header included. */
	readonly rows: string[][];
	/** `true` when rows past `maxRows` were not read. */
	readonly truncated: boolean;
}

/** Rows of the CSV; throws on a quote that is never closed. */
export function parseCsv(
	text: string,
	maxRows = Number.POSITIVE_INFINITY,
): CsvRows {
	const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	/** A quoted cell was read; text after its closing quote is appended. */
	let wasQuoted = false;
	let quoteStart = 0;
	/** Data row of the open quote: 1 is the first row after the header. */
	let quoteRow = 0;

	const endCell = (): void => {
		row.push(cell);
		cell = "";
		wasQuoted = false;
	};
	const endRow = (): void => {
		endCell();
		const blank = row.length === 1 && row[0] === "";
		if (!blank) rows.push(row);
		row = [];
	};

	for (let i = 0; i < source.length; i += 1) {
		if (rows.length >= maxRows) {
			return { rows, truncated: /\S/.test(source.slice(i)) };
		}
		const code = source.charCodeAt(i);
		if (quoted) {
			if (code !== QUOTE) {
				cell += source[i];
			} else if (source.charCodeAt(i + 1) === QUOTE) {
				cell += '"';
				i += 1;
			} else {
				quoted = false;
			}
		} else if (code === QUOTE && cell === "" && !wasQuoted) {
			quoted = true;
			wasQuoted = true;
			quoteStart = i;
			quoteRow = rows.length;
		} else if (code === COMMA) {
			endCell();
		} else if (code === LF || code === CR) {
			if (code === CR && source.charCodeAt(i + 1) === LF) i += 1;
			endRow();
		} else {
			cell += source[i];
		}
	}
	if (quoted) {
		throw new SchemaImportFailure(
			"CSV_QUOTE",
			`The CSV has a quote opened at character ${quoteStart + 1} that is never closed`,
			{ row: quoteRow },
		);
	}
	if (cell !== "" || row.length > 0 || wasQuoted) endRow();
	return { rows: rows.slice(0, maxRows), truncated: rows.length > maxRows };
}
