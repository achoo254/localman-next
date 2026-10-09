import { MAX_RENDERED_NODES, parseTemplateReference } from "./json-template.js";
import {
	DEFAULT_JSON_LIMITS,
	type JsonLimits,
	type JsonValue,
	jsonSize,
	primitiveBytes,
	utf8Length,
} from "./json-value.js";

export interface RenderContext {
	/** Values of `$name` variables; a missing name renders literally. */
	readonly variables?: ReadonlyMap<string, JsonValue>;
	/** Runs a Faker method; `undefined` for an id outside the whitelist. */
	resolveMethod(id: string): JsonValue | undefined;
	readonly limits?: JsonLimits;
	/** Output budget in JSON values, variables counted at full size. */
	readonly maxRenderedNodes?: number;
	/** Output budget in bytes of compact JSON (estimated); none if absent. */
	readonly maxBytes?: number;
}

export type TemplateErrorCode = "TEMPLATE_TOO_DEEP" | "TEMPLATE_TOO_LARGE";

export class JsonTemplateError extends Error {
	constructor(
		public readonly code: TemplateErrorCode,
		message: string,
		/** Estimated bytes produced when rendering stopped, if known. */
		public readonly bytes?: number,
	) {
		super(message);
		this.name = "JsonTemplateError";
	}
}

/**
 * Renders a template into a new JSON value; the template is not modified.
 * Unknown references stay literal (stored templates were validated, so
 * this only happens with data that predates a whitelist change). Objects
 * are rebuilt with `Object.fromEntries`, which defines own properties, so
 * a `__proto__` key can never reach a prototype.
 *
 * Output is metered while it is produced, in values and (with `maxBytes`)
 * in bytes: rendering throws `TEMPLATE_TOO_LARGE` as soon as a budget is
 * passed, so an oversized template costs at most one budget of work.
 */
export function renderJsonTemplate(
	template: JsonValue,
	context: RenderContext,
): JsonValue {
	const limits = context.limits ?? DEFAULT_JSON_LIMITS;
	const maxNodes = context.maxRenderedNodes ?? MAX_RENDERED_NODES;
	const maxBytes = context.maxBytes ?? Number.POSITIVE_INFINITY;
	const variableSizes = new Map<string, { nodes: number; bytes: number }>();
	let nodes = 0;
	let bytes = 0;

	const spend = (moreNodes: number, moreBytes: number): void => {
		nodes += moreNodes;
		bytes += moreBytes;
		if (nodes > maxNodes) {
			throw new JsonTemplateError(
				"TEMPLATE_TOO_LARGE",
				`Rendered template exceeds ${maxNodes} values`,
				bytes,
			);
		}
		if (bytes > maxBytes) {
			throw new JsonTemplateError(
				"TEMPLATE_TOO_LARGE",
				`Rendered template exceeds ${maxBytes} bytes`,
				bytes,
			);
		}
	};

	const resolve = (text: string): JsonValue => {
		const reference = parseTemplateReference(text);
		if (reference?.kind === "variable") {
			const value = context.variables?.get(reference.name);
			if (value !== undefined) {
				const size = variableSizes.get(reference.name) ?? jsonSize(value);
				variableSizes.set(reference.name, size);
				spend(size.nodes, size.bytes);
				return value;
			}
		} else if (reference?.kind === "method") {
			const value = context.resolveMethod(reference.id);
			if (value !== undefined) {
				const size = jsonSize(value);
				spend(size.nodes, size.bytes);
				return value;
			}
		}
		spend(1, primitiveBytes(text));
		return text;
	};

	const walk = (node: JsonValue, depth: number): JsonValue => {
		if (depth > limits.maxDepth) {
			throw new JsonTemplateError(
				"TEMPLATE_TOO_DEEP",
				`Template is nested deeper than ${limits.maxDepth} levels`,
			);
		}
		if (typeof node === "string") return resolve(node);
		if (node === null || typeof node !== "object") {
			spend(1, primitiveBytes(node));
			return node;
		}
		spend(1, 2);
		if (Array.isArray(node)) {
			return node.map((item, index) => {
				if (index > 0) spend(0, 1);
				return walk(item, depth + 1);
			});
		}
		return Object.fromEntries(
			Object.entries(node).map(([key, value], index) => {
				spend(0, utf8Length(key) + 3 + (index > 0 ? 1 : 0));
				return [key, walk(value, depth + 1)];
			}),
		);
	};

	return walk(template, 0);
}
