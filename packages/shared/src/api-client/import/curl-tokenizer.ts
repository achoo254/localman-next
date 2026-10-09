/**
 * Splits a pasted command into words the way its shell would, without
 * running anything: POSIX sh (bash, zsh, "Copy as cURL (bash)"), Windows
 * cmd ("Copy as cURL (cmd)", `^` escapes and continuations) and
 * PowerShell (backtick escapes and continuations). Adjacent quoted parts
 * join into one word (`'it'\''s'` is `it's`). Variables are not expanded.
 */
import { tokenizeCmd, tokenizePowerShell } from "./shell-tokenizer-windows.js";
import {
	type ShellWord,
	WordBuilder,
	unterminatedQuote,
} from "./shell-words.js";

export type ShellDialect = "posix" | "cmd" | "powershell";

/** cmd if it uses `^` line ends or `^"`; PowerShell if backtick line ends. */
export function detectShellDialect(text: string): ShellDialect {
	if (/\^\r?\n|\^"/.test(text)) return "cmd";
	if (/`\r?\n/.test(text)) return "powershell";
	return "posix";
}

const ANSI_C: Readonly<Record<string, string>> = {
	n: "\n",
	t: "\t",
	r: "\r",
	a: "\x07",
	b: "\b",
	e: "\x1b",
	E: "\x1b",
	f: "\f",
	v: "\v",
	"\\": "\\",
	"'": "'",
	'"': '"',
	"?": "?",
};

/** Body of `$'…'` from `start` (after `$'`); returns text and end index. */
function readAnsiC(s: string, start: number): [string, number] {
	let out = "";
	let i = start;
	while (i < s.length && s[i] !== "'") {
		if (s[i] !== "\\") {
			out += s[i];
			i += 1;
			continue;
		}
		const next = s[i + 1] ?? "";
		const hex = /^(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8})/.exec(
			s.slice(i + 1, i + 10),
		)?.[0];
		const octal = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))?.[0];
		if (hex) {
			const code = Number.parseInt(hex.slice(1), 16);
			out += code <= 0x10ffff ? String.fromCodePoint(code) : "";
			i += 1 + hex.length;
		} else if (octal) {
			out += String.fromCharCode(Number.parseInt(octal, 8) & 0xff);
			i += 1 + octal.length;
		} else {
			out += ANSI_C[next] ?? `\\${next}`;
			i += 2;
		}
	}
	if (i >= s.length) throw unterminatedQuote();
	return [out, i + 1];
}

function tokenizePosix(s: string): ShellWord[] {
	const w = new WordBuilder();
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		if (c === "\\") {
			const next = s[i + 1];
			if (next === "\n") i += 2;
			else if (next === "\r" && s[i + 2] === "\n") i += 3;
			else {
				if (next !== undefined) w.add(next, true);
				i += 2;
			}
		} else if (c === "'") {
			const close = s.indexOf("'", i + 1);
			if (close === -1) throw unterminatedQuote();
			w.add(s.slice(i + 1, close), true);
			i = close + 1;
		} else if (c === "$" && s[i + 1] === "'") {
			const [text, end] = readAnsiC(s, i + 2);
			w.add(text, true);
			i = end;
		} else if (c === '"') {
			let text = "";
			i += 1;
			while (i < s.length && s[i] !== '"') {
				const next = s[i + 1] ?? "";
				if (s[i] === "\\" && '$`"\\\n'.includes(next)) {
					if (next !== "\n") text += next;
					i += 2;
				} else {
					text += s[i];
					i += 1;
				}
			}
			if (i >= s.length) throw unterminatedQuote();
			w.add(text, true);
			i += 1;
		} else if (/\s/.test(c)) {
			w.end();
			i += 1;
		} else if (c === "#" && !w.inWord) {
			const lineEnd = s.indexOf("\n", i);
			i = lineEnd === -1 ? s.length : lineEnd;
		} else {
			w.add(c);
			i += 1;
		}
	}
	w.end();
	return w.words;
}

/** Throws `UNTERMINATED_QUOTE` for a quote that never closes. */
export function tokenizeCommand(
	text: string,
	dialect: ShellDialect = detectShellDialect(text),
): ShellWord[] {
	if (dialect === "cmd") return tokenizeCmd(text);
	if (dialect === "powershell") return tokenizePowerShell(text);
	return tokenizePosix(text);
}
