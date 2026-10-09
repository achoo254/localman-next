/**
 * Windows command lines: cmd ("Copy as cURL (cmd)": `^` escapes, `^` line
 * continuations, then arguments split as the Microsoft C runtime does)
 * and PowerShell (backtick escapes and continuations, `''` and `""`).
 */
import {
	type ShellWord,
	WordBuilder,
	unterminatedQuote,
} from "./shell-words.js";

/**
 * cmd layer: `^x` is `x`, `^` at a line end joins the next line and
 * escapes its first character; inside cmd's own quotes `^` is literal.
 */
function stripCmdEscapes(s: string): string {
	let out = "";
	let inQuote = false;
	for (let i = 0; i < s.length; i += 1) {
		const c = s[i];
		if (c === '"') inQuote = !inQuote;
		if (c !== "^" || inQuote) {
			out += c;
			continue;
		}
		if (s[i + 1] === "\r" && s[i + 2] === "\n") i += 2;
		else if (s[i + 1] === "\n") i += 1;
		if (i + 1 < s.length) out += s[i + 1];
		i += 1;
	}
	return out;
}

/** Program arguments as the Microsoft C runtime splits them. */
export function tokenizeCmd(source: string): ShellWord[] {
	const s = stripCmdEscapes(source);
	const w = new WordBuilder();
	let inQuote = false;
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		if (c === "\\") {
			let run = 0;
			while (s[i + run] === "\\") run += 1;
			if (s[i + run] === '"') {
				w.add("\\".repeat(Math.floor(run / 2)), true);
				if (run % 2 === 1) w.add('"', true);
				i += run + (run % 2);
			} else {
				w.add("\\".repeat(run));
				i += run;
			}
		} else if (c === '"') {
			if (inQuote && s[i + 1] === '"') {
				w.add('"', true);
				i += 2;
			} else {
				inQuote = !inQuote;
				w.add("", true);
				i += 1;
			}
		} else if (/\s/.test(c) && !inQuote) {
			w.end();
			i += 1;
		} else {
			w.add(c);
			i += 1;
		}
	}
	if (inQuote) throw unterminatedQuote();
	w.end();
	return w.words;
}

const PS_ESCAPES: Readonly<Record<string, string>> = {
	n: "\n",
	r: "\r",
	t: "\t",
	"0": "\0",
	a: "\x07",
	b: "\b",
	e: "\x1b",
	f: "\f",
	v: "\v",
};

export function tokenizePowerShell(s: string): ShellWord[] {
	const w = new WordBuilder();
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		if (c === "`") {
			const next = s[i + 1];
			if (next === "\n") i += 2;
			else if (next === "\r" && s[i + 2] === "\n") i += 3;
			else {
				if (next !== undefined) w.add(next, true);
				i += 2;
			}
		} else if (c === "'") {
			let text = "";
			i += 1;
			for (;;) {
				if (i >= s.length) throw unterminatedQuote();
				if (s[i] === "'" && s[i + 1] === "'") {
					text += "'";
					i += 2;
				} else if (s[i] === "'") break;
				else text += s[i++];
			}
			w.add(text, true);
			i += 1;
		} else if (c === '"') {
			let text = "";
			i += 1;
			for (;;) {
				if (i >= s.length) throw unterminatedQuote();
				const next = s[i + 1] ?? "";
				if (s[i] === "`") {
					text += PS_ESCAPES[next] ?? next;
					i += 2;
				} else if (s[i] === '"' && next === '"') {
					text += '"';
					i += 2;
				} else if (s[i] === '"') break;
				else text += s[i++];
			}
			w.add(text, true);
			i += 1;
		} else if (/\s/.test(c)) {
			w.end();
			i += 1;
		} else {
			w.add(c);
			i += 1;
		}
	}
	w.end();
	return w.words;
}
