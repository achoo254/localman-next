/**
 * String literals for each snippet language, quotes included. Every
 * function returns source text that evaluates back to exactly `text`:
 * quotes, backslashes, interpolation sigils (`$` in Kotlin and Dart, `#`
 * in Ruby), line breaks, control characters and Unicode included.
 */

type ControlEscape = (code: number) => string;

const hex = (code: number, width: number): string =>
	code.toString(16).toUpperCase().padStart(width, "0");

const unicode4: ControlEscape = (code) => `\\u${hex(code, 4)}`;
const unicodeBraces: ControlEscape = (code) => `\\u{${hex(code, 1)}}`;
const hex2: ControlEscape = (code) =>
	code <= 0xff ? `\\x${hex(code, 2)}` : unicode4(code);

const COMMON: Readonly<Record<string, string>> = {
	"\\": "\\\\",
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
};

/**
 * NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR end a line in C# source (and
 * in older JavaScript), so they are escaped everywhere.
 */
const LINE_BREAKS: ReadonlySet<number> = new Set([0x85, 0x2028, 0x2029]);

/** Escapes `text` character by character; controls go through `control`. */
function escapeChars(
	text: string,
	extra: Readonly<Record<string, string>>,
	control: ControlEscape,
): string {
	let out = "";
	for (const char of text) {
		const mapped = Object.hasOwn(extra, char)
			? extra[char]
			: Object.hasOwn(COMMON, char)
				? COMMON[char]
				: undefined;
		const code = char.codePointAt(0) ?? 0;
		if (mapped !== undefined) out += mapped;
		else if (code < 0x20 || code === 0x7f || LINE_BREAKS.has(code)) {
			out += control(code);
		} else out += char;
	}
	return out;
}

/** POSIX shell: single quotes, `'` as `'\''`. Nothing else is special. */
export function shellQuote(text: string): string {
	return `'${text.replace(/'/g, "'\\''")}'`;
}

/** JavaScript and Python: single-quoted, `\xHH` for control characters. */
export function singleQuotedC(text: string): string {
	return `'${escapeChars(text, { "'": "\\'" }, hex2)}'`;
}

/** Java, C# and Go: double-quoted, `\uXXXX` for control characters. */
export function doubleQuotedC(text: string): string {
	return `"${escapeChars(text, { '"': '\\"' }, unicode4)}"`;
}

/** Kotlin: like Java, plus `$` (string templates). */
export function kotlinString(text: string): string {
	return `"${escapeChars(text, { '"': '\\"', $: "\\$" }, unicode4)}"`;
}

/** Swift and Rust: double-quoted, `\u{X}` for control characters. */
export function doubleQuotedBraces(text: string): string {
	return `"${escapeChars(text, { '"': '\\"' }, unicodeBraces)}"`;
}

/** Dart: single-quoted, `$` escaped (interpolation). */
export function dartString(text: string): string {
	return `'${escapeChars(text, { "'": "\\'", $: "\\$" }, unicodeBraces)}'`;
}

/** Ruby: double-quoted with Ruby escapes; `#` escaped (interpolation). */
export function rubyString(text: string): string {
	return `"${escapeChars(text, { '"': '\\"', "#": "\\#" }, unicodeBraces)}"`;
}

/** PHP: single-quoted; only `\` and `'` are escapes there. */
export function phpString(text: string): string {
	return `'${text.replace(/[\\']/g, "\\$&")}'`;
}

/**
 * PowerShell: single-quoted (no `$` or backtick expansion). PowerShell also
 * reads the typographic quotes `‘ ’ ‚ ‛` as quotes, so they are doubled too.
 */
export function powershellString(text: string): string {
	return `'${text.replace(/['‘’‚‛]/g, "$&$&")}'`;
}
