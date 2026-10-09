/**
 * Tokens of the TypeScript subset `typescript-type-parser.ts` reads.
 * Comments and whitespace are dropped; anything outside identifiers,
 * literals and type punctuation is a syntax error (`SchemaImportFailure`).
 */
import { SchemaImportFailure } from "./schema-import-errors.js";

export type TsToken =
	| {
			readonly kind: "word" | "number" | "template" | "punct";
			readonly text: string;
			readonly offset: number;
	  }
	| {
			readonly kind: "string";
			readonly text: string;
			/** Content without quotes, escapes resolved to their character. */
			readonly value: string;
			readonly offset: number;
	  };

const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y;
const TEMPLATE = /`(?:[^`\\]|\\[\s\S])*`/y;
const PUNCT = new Set("{}()[]<>;,:?|&=.-");

/** Throws an `INVALID_INPUT` failure naming the line of `offset`. */
export function syntaxError(
	source: string,
	offset: number,
	message: string,
): never {
	const line = source.slice(0, offset).split("\n").length;
	throw new SchemaImportFailure("INVALID_INPUT", `${message} at line ${line}`);
}

/** Text matched by the sticky `pattern` at `offset`, or `null`. */
function matchAt(
	pattern: RegExp,
	source: string,
	offset: number,
): string | null {
	pattern.lastIndex = offset;
	return pattern.exec(source)?.[0] ?? null;
}

export function tokenizeTypeScript(source: string): TsToken[] {
	const tokens: TsToken[] = [];
	let offset = 0;
	while (offset < source.length) {
		const char = source.charAt(offset);
		const pair = source.slice(offset, offset + 2);
		if (/\s/.test(char)) {
			offset += 1;
			continue;
		}
		if (pair === "//" || pair === "/*") {
			const end = source.indexOf(pair === "//" ? "\n" : "*/", offset + 2);
			if (end === -1 && pair === "/*")
				syntaxError(source, offset, "Unclosed comment");
			offset = end === -1 ? source.length : end + (pair === "//" ? 1 : 2);
			continue;
		}
		const push = (
			kind: "word" | "number" | "template" | "punct",
			text: string,
		) => tokens.push({ kind, text, offset });
		const string = matchAt(STRING, source, offset);
		const other =
			string ??
			matchAt(TEMPLATE, source, offset) ??
			matchAt(WORD, source, offset) ??
			matchAt(NUMBER, source, offset);
		if (string !== null) {
			const value = string.slice(1, -1).replace(/\\(.)/g, "$1");
			tokens.push({ kind: "string", text: string, value, offset });
		} else if (other !== null) {
			const kind = other.startsWith("`")
				? "template"
				: /^\d/.test(other)
					? "number"
					: "word";
			push(kind, other);
		} else if (pair === "=>" || source.startsWith("...", offset)) {
			push("punct", pair === "=>" ? pair : "...");
		} else if (PUNCT.has(char)) {
			push("punct", char);
		} else {
			syntaxError(source, offset, `Unexpected character "${char}"`);
		}
		offset += tokens[tokens.length - 1]?.text.length ?? 1;
	}
	return tokens;
}
