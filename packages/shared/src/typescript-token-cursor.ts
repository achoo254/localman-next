/**
 * Position in the token list of `typescript-type-parser.ts`, with the
 * matching, skipping and error helpers the parser builds on. Errors are
 * `SchemaImportFailure`s naming the line of the offending token.
 */
import { SchemaImportFailure } from "./schema-import-errors.js";
import { type TsToken, syntaxError } from "./typescript-tokenizer.js";

/** Nested types (objects, parentheses, generics) a declaration may hold. */
export const MAX_TYPE_DEPTH = 10;

export class TokenCursor {
	protected pos = 0;

	constructor(
		protected readonly source: string,
		protected readonly tokens: readonly TsToken[],
	) {}

	protected peek(offset = 0): TsToken | undefined {
		return this.tokens[this.pos + offset];
	}

	protected is(text: string, offset = 0): boolean {
		const token = this.peek(offset);
		return token?.kind === "word" || token?.kind === "punct"
			? token.text === text
			: false;
	}

	protected eat(text: string): boolean {
		if (!this.is(text)) return false;
		this.pos += 1;
		return true;
	}

	protected expect(text: string): void {
		if (!this.eat(text)) this.fail(`Expected "${text}"`);
	}

	protected fail(message: string): never {
		const token = this.peek();
		const found = token === undefined ? "end of input" : `"${token.text}"`;
		return syntaxError(
			this.source,
			token?.offset ?? this.source.length,
			`${message}, found ${found}`,
		);
	}

	protected word(): string {
		const token = this.peek();
		if (token?.kind !== "word") return this.fail("Expected a name");
		this.pos += 1;
		return token.text;
	}

	protected qualifiedName(): string {
		let name = this.word();
		while (this.eat(".")) name += `.${this.word()}`;
		return name;
	}

	/** Skips `open … close` with nesting; `optional` allows it to be absent. */
	protected skipBalanced(open: string, close: string, optional = false): void {
		if (optional && !this.is(open)) return;
		this.expect(open);
		for (let level = 1; level > 0; ) {
			const token = this.peek();
			if (token === undefined) this.fail(`Expected "${close}"`);
			if (this.is(open)) level += 1;
			if (this.is(close)) level -= 1;
			if (level > MAX_TYPE_DEPTH) this.tooDeep();
			this.pos += 1;
		}
	}

	protected tooDeep(): never {
		throw new SchemaImportFailure(
			"TOO_DEEP",
			`Types are nested deeper than ${MAX_TYPE_DEPTH} levels`,
			{ max: MAX_TYPE_DEPTH },
		);
	}
}
