import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { tokenizeCommand } from "../import/curl-tokenizer.js";
import {
	dartString,
	doubleQuotedBraces,
	doubleQuotedC,
	kotlinString,
	phpString,
	powershellString,
	rubyString,
	shellQuote,
	singleQuotedC,
} from "./snippet-escape.js";
import { ADVERSARIAL } from "./snippet-test-fixtures.js";

/** Reads C-family escapes, as Kotlin, Swift, Rust, Dart and Ruby do for these. */
function decodeCLike(literal: string): string {
	const body = literal.slice(1, -1);
	const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t" };
	return body.replace(
		/\\(u\{([0-9A-Fa-f]+)\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|.)/gs,
		(_m, all: string, braces?: string, four?: string, two?: string) => {
			const code = braces ?? four ?? two;
			if (code !== undefined)
				return String.fromCodePoint(Number.parseInt(code, 16));
			return simple[all] ?? all;
		},
	);
}

describe("snippet string literals", () => {
	it.each(ADVERSARIAL)("shell quoting round-trips %j", (text) => {
		const [, word] = tokenizeCommand(`x ${shellQuote(text)}`, "posix");
		expect(word?.text ?? "").toBe(text);
	});

	it.each(ADVERSARIAL)(
		"JavaScript / Python literal evaluates to %j",
		(text) => {
			expect(runInNewContext(singleQuotedC(text))).toBe(text);
		},
	);

	it.each(ADVERSARIAL)("Java / C# / Go literal parses to %j", (text) => {
		// These escapes (\" \\ \n \r \t \uXXXX) mean the same in JSON.
		expect(JSON.parse(doubleQuotedC(text))).toBe(text);
	});

	it.each(ADVERSARIAL)(
		"Kotlin, Dart, Swift, Rust, Ruby literals decode to %j",
		(text) => {
			for (const quote of [
				kotlinString,
				dartString,
				doubleQuotedBraces,
				rubyString,
			]) {
				expect(decodeCLike(quote(text))).toBe(text);
			}
		},
	);

	it("escapes interpolation sigils", () => {
		expect(kotlinString("$a ${b}")).toBe('"\\$a \\${b}"');
		expect(dartString("$a ${b}")).toBe("'\\$a \\${b}'");
		expect(rubyString("#{a}")).toBe('"\\#{a}"');
		expect(doubleQuotedBraces("\\(x)")).toBe('"\\\\(x)"');
		expect(rubyString("a\nb")).toBe('"a\\nb"');
	});

	it.each(ADVERSARIAL)("PHP single-quoted literal reads back %j", (text) => {
		const body = phpString(text).slice(1, -1);
		expect(body.replace(/\\([\\'])/g, "$1")).toBe(text);
		expect(body.replace(/\\[\\']/g, "")).not.toMatch(/'/);
	});

	it.each(ADVERSARIAL)(
		"PowerShell single-quoted literal reads back %j",
		(text) => {
			const body = powershellString(text).slice(1, -1);
			expect(body.replace(/(['‘’‚‛])\1/g, "$1")).toBe(text);
			expect(body).not.toMatch(/\$\(|`/.test(text) ? /^$/ : /`/);
		},
	);
});
