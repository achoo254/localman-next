/** Longest pattern a `regex` rule may hold. */
export const MAX_REGEX_LENGTH = 200;
/**
 * Longest text a `regex` rule tests; a longer value never matches. With
 * the cost bound below this caps the backtracking any stored pattern can
 * cause, whatever the request sends.
 */
export const MAX_REGEX_INPUT = 1024;
/** Upper bound of backtracking steps a pattern may need on one input. */
export const MAX_REGEX_COST = 2 ** 20;

/** `{n}`, `{n,}` or `{n,m}`, any number of digits. */
const QUANTIFIER = /\{(\d+)(?:(,)(\d*))?\}/y;
const LOOKAROUND = ["(?=", "(?!", "(?<=", "(?<!"];

/** Index just past the character class opening at `start`. */
function skipClass(pattern: string, start: number): number {
	let index = start + 1;
	while (index < pattern.length && pattern[index] !== "]") {
		index += pattern[index] === "\\" ? 2 : 1;
	}
	return index + 1;
}

/** Index just past the escape at `start` (`\p{…}` and `\u{…}` whole). */
function skipEscape(pattern: string, start: number): number {
	const next = pattern[start + 1] ?? "";
	if ("pPu".includes(next) && pattern[start + 2] === "{") {
		const close = pattern.indexOf("}", start);
		return close === -1 ? pattern.length : close + 1;
	}
	return start + 2;
}

interface Quantifier {
	readonly length: number;
	/** Repetition counts the engine may try: `max - min + 1`, unbounded = input. */
	readonly choices: number;
}

/**
 * The quantifier at `index`, `"invalid"` for a `{` that does not open one
 * (refused rather than read as a literal), `null` for no quantifier.
 */
function quantifierAt(
	pattern: string,
	index: number,
): Quantifier | "invalid" | null {
	const char = pattern[index];
	if (char === "*" || char === "+") {
		return { length: 1, choices: MAX_REGEX_INPUT };
	}
	if (char === "?") return { length: 1, choices: 2 };
	if (char !== "{") return null;
	QUANTIFIER.lastIndex = index;
	const match = QUANTIFIER.exec(pattern);
	if (!match) return "invalid";
	const [whole, min = "0", comma, max = ""] = match;
	// Input is at most MAX_REGEX_INPUT long, so larger counts add no choice.
	const choices =
		comma === undefined
			? 1
			: max === ""
				? MAX_REGEX_INPUT
				: Math.min(Number(max) - Number(min) + 1, MAX_REGEX_INPUT);
	return { length: whole.length, choices: Math.max(1, choices) };
}

/** Index of the first character inside the group opening at `start`. */
function groupBodyStart(pattern: string, start: number): number {
	if (pattern.startsWith("(?:", start)) return start + 3;
	if (pattern.startsWith("(?<", start)) {
		const close = pattern.indexOf(">", start);
		return close === -1 ? pattern.length : close + 1;
	}
	return start + 1;
}

/**
 * Why `pattern` may not be used as a rule regex, or `null` when it is
 * safe. JavaScript regexes backtrack, so a pattern like `(a+)+$` can take
 * exponential time (ReDoS). Only a subset with a provable bound is kept:
 *
 * - at most `MAX_REGEX_LENGTH` characters, valid with the `u` flag;
 * - no backreferences and no lookaround;
 * - no quantifier on a group: `(…)*`, `(…)+`, `(…){n}` are refused, which
 *   rules out nested quantifiers and repeated alternation;
 * - every `{` outside a class or escape opens a quantifier (`{n}`,
 *   `{n,}`, `{n,m}` with any number of digits), else the pattern is
 *   refused;
 * - the product of every quantifier's choices (`max - min + 1`, capped
 *   like an unbounded one at `MAX_REGEX_INPUT`; each `|` counts 2), times the start positions
 *   (`MAX_REGEX_INPUT`, or 1 for a pattern anchored with `^` and no `|`),
 *   stays within `MAX_REGEX_COST`. In practice: one `+`/`*` anywhere, or
 *   two in a pattern starting with `^`.
 *
 * Input longer than `MAX_REGEX_INPUT` never matches (see the runtime).
 */
export function unsafeRegexReason(pattern: string): string | null {
	if (pattern.length === 0) return "The pattern is empty";
	if (pattern.length > MAX_REGEX_LENGTH) {
		return `A pattern has at most ${MAX_REGEX_LENGTH} characters`;
	}
	try {
		new RegExp(pattern, "u");
	} catch {
		return "Not a valid regular expression";
	}
	let cost = 1;
	let previous: "atom" | "group" | "none" = "none";
	let alternation = false;
	let index = 0;
	while (index < pattern.length) {
		const char = pattern[index] ?? "";
		const quantifier = quantifierAt(pattern, index);
		if (quantifier === "invalid" || (quantifier && previous === "none")) {
			return "Not a valid regular expression";
		}
		if (quantifier) {
			if (previous === "group") return "A group cannot be repeated";
			cost *= quantifier.choices;
			index += quantifier.length;
			if (pattern[index] === "?") index += 1;
			previous = "none";
		} else if (char === "\\") {
			if (/[1-9k]/.test(pattern[index + 1] ?? "")) {
				return "Backreferences are not allowed";
			}
			index = skipEscape(pattern, index);
			previous = "atom";
		} else if (char === "[") {
			index = skipClass(pattern, index);
			previous = "atom";
		} else if (char === "(") {
			if (LOOKAROUND.some((open) => pattern.startsWith(open, index))) {
				return "Lookahead and lookbehind are not allowed";
			}
			index = groupBodyStart(pattern, index);
			previous = "none";
		} else {
			if (char === "|") {
				alternation = true;
				cost *= 2;
			}
			index += 1;
			previous = char === ")" ? "group" : char === "|" ? "none" : "atom";
		}
		if (cost > MAX_REGEX_COST) break;
	}
	const anchored = pattern.startsWith("^") && !alternation;
	if (cost * (anchored ? 1 : MAX_REGEX_INPUT) > MAX_REGEX_COST) {
		return "The pattern is too complex: use at most one + or * (two when it starts with ^)";
	}
	return null;
}
