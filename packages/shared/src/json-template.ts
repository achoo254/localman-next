import {
	type JsonCheck,
	type JsonLimits,
	type JsonValue,
	checkJson,
	primitiveBytes,
	utf8Length,
} from "./json-value.js";

/**
 * JSON templates (object templates and custom responses, as in mockapi.io).
 * A string leaf is replaced only when the WHOLE string is one variable:
 *
 * - `"$mockData"`, `"$count"`: values supplied by the caller;
 * - `"$category.method"`: a whitelisted Faker method, called per render.
 *
 * Interpolation inside longer strings (`"Hi $name.firstName"`) is not a
 * feature of the source and is not supported: such strings stay literal.
 * Nothing is ever evaluated; variables and methods are looked up in maps
 * the caller provides, so `$constructor` or `$__proto__` resolve to nothing.
 */
export const TEMPLATE_VARIABLE_PATTERN =
	/^\$([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?$/;

/** Variables a custom endpoint response may use. */
export const RESPONSE_VARIABLES = ["mockData", "count"] as const;

/** Most values a rendered template may produce (variables included). */
export const MAX_RENDERED_NODES = 50_000;
/**
 * Most `$category.method` references a stored template may hold: each one
 * runs Faker on every render, so a template of thousands of
 * `$lorem.paragraphs` would be a cheap way to burn CPU.
 */
export const MAX_METHOD_REFERENCES = 200;

export type TemplateReference =
	| { readonly kind: "variable"; readonly name: string }
	| { readonly kind: "method"; readonly id: string };

/** What a whole-string `$…` reference points to, or `null` for literals. */
export function parseTemplateReference(text: string): TemplateReference | null {
	const match = TEMPLATE_VARIABLE_PATTERN.exec(text);
	if (!match) return null;
	const [, head = "", tail] = match;
	return tail === undefined
		? { kind: "variable", name: head }
		: { kind: "method", id: `${head}.${tail}` };
}

export interface TemplateRules {
	/** Variable names allowed in this kind of template. */
	readonly variables: readonly string[];
	/** Whether `category.method` is a whitelisted Faker method. */
	isMethod(id: string): boolean;
	readonly limits?: JsonLimits;
	/** Defaults to `MAX_METHOD_REFERENCES`. */
	readonly maxMethodReferences?: number;
}

/**
 * Validates a template before it is stored: it must be JSON within limits,
 * and every `$…` reference must be an allowed variable or a whitelisted
 * method. Rejecting unknown references at save time (rather than rendering
 * them literally) surfaces typos such as `$mockdata` and attempts such as
 * `$constructor.constructor`.
 */
export function checkTemplate(
	template: unknown,
	rules: TemplateRules,
): JsonCheck {
	const allowed = new Set(rules.variables);
	const maxMethods = rules.maxMethodReferences ?? MAX_METHOD_REFERENCES;
	let methods = 0;
	return checkJson(template, rules.limits, (text) => {
		const reference = parseTemplateReference(text);
		if (!reference) return null;
		if (reference.kind === "variable") {
			return allowed.has(reference.name)
				? null
				: `Unknown template variable "${text}"`;
		}
		if (!rules.isMethod(reference.id)) return `Unknown Faker method "${text}"`;
		methods += 1;
		// Reported once, at the first reference over the limit.
		return methods === maxMethods + 1
			? `A template may call at most ${maxMethods} Faker methods`
			: null;
	});
}

/**
 * Most bytes of compact JSON one render of `template` can produce: literal
 * parts at their size, each `$category.method` at `methodMaxBytes`.
 * Variables are not expanded (object templates have none).
 */
export function estimateTemplateBytes(
	template: JsonValue,
	methodMaxBytes: (id: string) => number,
): number {
	if (typeof template === "string") {
		const reference = parseTemplateReference(template);
		return reference?.kind === "method"
			? methodMaxBytes(reference.id)
			: primitiveBytes(template);
	}
	if (template === null || typeof template !== "object") {
		return primitiveBytes(template);
	}
	const entries = Array.isArray(template)
		? template.map((item) => ["", item] as const)
		: Object.entries(template);
	let bytes = 2 + Math.max(0, entries.length - 1);
	for (const [key, item] of entries) {
		if (!Array.isArray(template)) bytes += utf8Length(key) + 3;
		bytes += estimateTemplateBytes(item, methodMaxBytes);
	}
	return bytes;
}
