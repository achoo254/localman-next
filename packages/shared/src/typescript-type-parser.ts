/**
 * Reads the TypeScript a user pastes to describe a resource: `interface X
 * { … }` and `type X = …` declarations, nothing else. A hand-written
 * tokenizer and recursive-descent parser; no `eval`, no compiler. Generic
 * arguments and tuples are skipped, nesting is bounded by
 * `MAX_TYPE_DEPTH`, and any other statement (code) is a syntax error.
 */
import { MAX_TYPE_DEPTH, TokenCursor } from "./typescript-token-cursor.js";
import { type TsToken, tokenizeTypeScript } from "./typescript-tokenizer.js";
import type { TsDeclaration, TsMember, TsType } from "./typescript-type-ast.js";

const KEYWORDS = new Set([
	...["string", "number", "boolean", "bigint", "symbol", "any", "unknown"],
	...["object", "never", "void", "null", "undefined"],
]);

class Parser extends TokenCursor {
	private depth = 0;

	constructor(
		source: string,
		tokens: readonly TsToken[],
		private readonly warn: (path: string, message: string) => void,
	) {
		super(source, tokens);
	}

	declarations(): TsDeclaration[] {
		const out: TsDeclaration[] = [];
		while (this.peek() !== undefined) {
			if (this.eat(";")) continue;
			this.eat("export");
			this.eat("declare");
			if (this.eat("interface")) {
				const name = this.word();
				this.skipBalanced("<", ">", true);
				const bases: string[] = [];
				while (this.eat(bases.length === 0 ? "extends" : ",")) {
					bases.push(this.qualifiedName());
					this.skipBalanced("<", ">", true);
				}
				this.expect("{");
				out.push({ name, type: this.objectBody(), bases });
			} else if (this.eat("type")) {
				const name = this.word();
				this.skipBalanced("<", ">", true);
				this.expect("=");
				out.push({ name, type: this.type(), bases: [] });
			} else {
				this.fail("Expected an interface or type declaration");
			}
		}
		return out;
	}

	private objectBody(): TsType {
		const members: TsMember[] = [];
		while (!this.eat("}")) {
			if (this.eat(";") || this.eat(",")) continue;
			const member = this.member();
			if (member !== null) members.push(member);
		}
		return { kind: "object", members };
	}

	private member(): TsMember | null {
		if (this.is("readonly") && !/^[?:(;,}]$/.test(this.peek(1)?.text ?? "")) {
			this.pos += 1;
		}
		if (this.is("[")) {
			this.skipBalanced("[", "]");
			this.eat("?");
			this.expect(":");
			this.type();
			this.warn("", "Index signatures are skipped");
			return null;
		}
		const token = this.peek();
		if (token === undefined || token.kind === "punct") {
			return this.fail("Expected a property name");
		}
		this.pos += 1;
		const name = token.kind === "string" ? token.value : token.text;
		this.eat("?");
		if (this.is("(") || this.is("<")) {
			this.skipBalanced("<", ">", true);
			this.skipBalanced("(", ")");
			if (this.eat(":")) this.type();
			this.warn(name, "Methods are skipped");
			return null;
		}
		// `name;` without a type is `any` in TypeScript.
		if (!this.eat(":")) return { name, type: { kind: "keyword", name: "any" } };
		return { name, type: this.type() };
	}

	private type(): TsType {
		this.depth += 1;
		if (this.depth > MAX_TYPE_DEPTH) this.tooDeep();
		const union = this.list("|", "union");
		if (this.is("extends")) this.fail("Conditional types are not supported");
		this.depth -= 1;
		return union;
	}

	private list(separator: string, kind: "union" | "intersection"): TsType {
		this.eat(separator);
		const next = (): TsType =>
			kind === "union" ? this.list("&", "intersection") : this.postfix();
		const types = [next()];
		while (this.eat(separator)) types.push(next());
		return types.length === 1 ? types[0] : { kind, types };
	}

	private postfix(): TsType {
		let type = this.primary();
		while (this.is("[") && this.is("]", 1)) {
			this.pos += 2;
			type = { kind: "array" };
		}
		return type;
	}

	private primary(): TsType {
		const token = this.peek();
		if (token === undefined) return this.fail("Expected a type");
		if (token.kind === "string" || token.kind === "template") {
			this.pos += 1;
			return token.kind === "string"
				? { kind: "literal", value: token.value }
				: { kind: "keyword", name: "string" };
		}
		const negative = this.is("-") && this.peek(1)?.kind === "number";
		if (token.kind === "number" || negative) {
			if (negative) this.pos += 1;
			const digits = this.peek()?.text.replace(/_/g, "") ?? "";
			this.pos += 1;
			return { kind: "literal", value: (negative ? -1 : 1) * Number(digits) };
		}
		if (this.eat("{")) return this.objectBody();
		if (this.is("[")) {
			this.skipBalanced("[", "]");
			return { kind: "array" };
		}
		if (this.is("(") || this.is("<")) return this.parenOrFunction();
		const word = this.word();
		if (KEYWORDS.has(word)) return { kind: "keyword", name: word };
		if (word === "true" || word === "false") {
			return { kind: "literal", value: word === "true" };
		}
		if (word === "readonly") return this.postfix();
		if (word === "keyof" || word === "typeof" || word === "unique") {
			this.postfix();
			return { kind: "other" };
		}
		this.pos -= 1;
		const name = this.qualifiedName();
		this.skipBalanced("<", ">", true);
		return { kind: "ref", name };
	}

	private parenOrFunction(): TsType {
		const start = this.pos;
		this.skipBalanced("<", ">", true);
		this.skipBalanced("(", ")");
		if (this.eat("=>")) {
			this.type();
			return { kind: "function" };
		}
		this.pos = start;
		this.expect("(");
		const inner = this.type();
		this.expect(")");
		return inner;
	}
}

/** Declarations of `source` in order; throws `SchemaImportFailure`. */
export function parseTypeScriptDeclarations(
	source: string,
	warn: (path: string, message: string) => void,
): TsDeclaration[] {
	const tokens = tokenizeTypeScript(source);
	return new Parser(source, tokens, warn).declarations();
}
