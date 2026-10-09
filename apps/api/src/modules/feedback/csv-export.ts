/** Characters that make spreadsheets read a cell as a formula (OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export type CsvValue = string | number | boolean | null | undefined;

/**
 * One CSV cell: a value that a spreadsheet would run as a formula gets a
 * leading `'`, then RFC 4180 quoting applies.
 */
export function csvCell(value: CsvValue): string {
	let text = value === null || value === undefined ? "" : String(value);
	if (FORMULA_START.test(text)) text = `'${text}`;
	return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * RFC 4180 CSV with CRLF line ends and a UTF-8 BOM, so Excel shows
 * Vietnamese text correctly when the file is opened directly.
 */
export function toCsv(
	header: readonly string[],
	rows: readonly (readonly CsvValue[])[],
): string {
	const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
	return `\uFEFF${lines.join("\r\n")}\r\n`;
}
