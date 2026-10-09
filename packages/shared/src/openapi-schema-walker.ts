/**
 * Walks OpenAPI / JSON Schema nodes for `schema-from-openapi.ts`: the
 * merged properties of an object schema and the import shape of one
 * property. Every visit, and every property copied while merging, counts
 * against `MAX_OPENAPI_STEPS`; nesting counts against `MAX_OPENAPI_DEPTH`;
 * a `$ref` met again on its own path is a cycle.
 */
import { type JsonObject, type JsonValue, isJsonObject } from "./json-value.js";
import { deref } from "./openapi-ref.js";
import {
	type EnumValue,
	type ImportedShape,
	SchemaImportFailure,
} from "./schema-import-fields.js";

/** Nesting of `allOf`/`oneOf`/`anyOf` and `$ref` hops walked at most. */
export const MAX_OPENAPI_DEPTH = 32;
/**
 * Schemas visited plus properties copied per import, against `allOf`
 * fan-out bombs (many `$ref` to one schema with many properties).
 */
export const MAX_OPENAPI_STEPS = 20_000;

export interface WalkedShape {
	readonly shape: ImportedShape;
	/** First `$ref` of the schema, or of its items for an array. */
	readonly ref: string | null;
}

const list = (node: JsonObject, key: string): JsonValue[] => {
	const value = Object.hasOwn(node, key) ? node[key] : undefined;
	return Array.isArray(value) ? value : [];
};
const isNullSchema = (node: JsonValue): boolean =>
	isJsonObject(node) && node.type === "null";

type Properties = ReadonlyMap<string, JsonValue>;

export class SchemaWalker {
	private steps = 0;
	/**
	 * Merged properties per `$ref`, with the depth they were walked at.
	 * A walk that succeeded at some depth succeeds at any shallower one,
	 * and a cycle through the `$ref` would have failed that walk, so the
	 * result is reused there instead of walking the subtree again.
	 */
	private readonly merged = new Map<
		string,
		{ props: Properties; depth: number }
	>();

	constructor(private readonly root: JsonObject) {}

	/** Counts `amount` units of work; past `MAX_OPENAPI_STEPS` the import fails. */
	private charge(amount: number): void {
		this.steps += amount;
		if (this.steps > MAX_OPENAPI_STEPS) {
			throw new SchemaImportFailure("TOO_COMPLEX", "The schema is too complex");
		}
	}

	/** Resolves `node` and guards depth, work and `$ref` cycles. */
	private enter(node: JsonValue, depth: number, stack: readonly string[]) {
		this.charge(1);
		if (depth > MAX_OPENAPI_DEPTH) {
			throw new SchemaImportFailure(
				"TOO_DEEP",
				`Schemas are nested deeper than ${MAX_OPENAPI_DEPTH} levels`,
			);
		}
		const { value, ref } = deref(this.root, node);
		if (ref !== null && stack.includes(ref)) {
			throw new SchemaImportFailure("REF_CYCLE", `${ref} includes itself`);
		}
		return { value, ref, stack: ref === null ? stack : [...stack, ref] };
	}

	/** Properties of an object schema, merged through `allOf`. */
	properties(
		node: JsonValue,
		depth = 0,
		stack: readonly string[] = [],
	): Properties {
		const { value, ref, stack: inner } = this.enter(node, depth, stack);
		const known = ref === null ? undefined : this.merged.get(ref);
		if (known && depth <= known.depth) return known.props;
		const props = this.merge(value, depth, inner);
		if (ref !== null) this.merged.set(ref, { props, depth });
		return props;
	}

	private merge(
		value: JsonValue,
		depth: number,
		inner: readonly string[],
	): Properties {
		const out = new Map<string, JsonValue>();
		if (!isJsonObject(value)) return out;
		for (const part of list(value, "allOf")) {
			const props = this.properties(part, depth + 1, inner);
			this.charge(props.size);
			for (const entry of props) out.set(...entry);
		}
		const own = Object.hasOwn(value, "properties") ? value.properties : null;
		if (isJsonObject(own)) {
			const entries = Object.entries(own);
			this.charge(entries.length);
			for (const entry of entries) out.set(...entry);
		}
		const branch = [...list(value, "oneOf"), ...list(value, "anyOf")].find(
			(member) => !isNullSchema(member),
		);
		return out.size === 0 && branch !== undefined
			? this.properties(branch, depth + 1, inner)
			: out;
	}

	/** Field shape of a property schema. */
	shape(
		node: JsonValue,
		depth = 0,
		stack: readonly string[] = [],
	): WalkedShape {
		const { value, ref, stack: inner } = this.enter(node, depth, stack);
		if (!isJsonObject(value)) return { shape: { kind: "unknown" }, ref };
		const types = (
			Array.isArray(value.type) ? value.type : [value.type]
		).filter((type) => typeof type === "string" && type !== "null");
		const type = types[0];
		const format = typeof value.format === "string" ? value.format : undefined;
		const values = [
			...list(value, "enum"),
			...(value.const === undefined ? [] : [value.const]),
		].filter((v): v is EnumValue => v !== null && typeof v !== "object");
		if (values.length > 0 && type !== "boolean") {
			return { shape: { kind: "enum", values }, ref };
		}
		if (type === "string") {
			const isDate = format === "date" || format === "date-time";
			return {
				shape: isDate ? { kind: "date" } : { kind: "string", format },
				ref,
			};
		}
		if (type === "number" || type === "integer")
			return { shape: { kind: "number" }, ref };
		if (type === "boolean") return { shape: { kind: "boolean" }, ref };
		if (
			type === "array" ||
			(type === undefined && Object.hasOwn(value, "items"))
		) {
			const items = Object.hasOwn(value, "items") ? value.items : undefined;
			const itemRef = items === undefined ? null : deref(this.root, items).ref;
			return { shape: { kind: "array" }, ref: itemRef };
		}
		if (type === "object" || Object.hasOwn(value, "properties")) {
			return { shape: { kind: "object" }, ref };
		}
		if (list(value, "allOf").length > 1)
			return { shape: { kind: "object" }, ref };
		const first = ["allOf", "oneOf", "anyOf"]
			.flatMap((key) => list(value, key))
			.find((member) => !isNullSchema(member));
		if (first === undefined) return { shape: { kind: "unknown" }, ref };
		const walked = this.shape(first, depth + 1, inner);
		return { shape: walked.shape, ref: ref ?? walked.ref };
	}
}
