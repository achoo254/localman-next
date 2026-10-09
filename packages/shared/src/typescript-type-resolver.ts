/**
 * Maps parsed TypeScript types (`typescript-type-parser.ts`) onto import
 * shapes: fields of an interface after `extends` and `&`, aliases and
 * literal unions, global types such as `Date` and `Record`. Aliases are
 * memoised and recursion stops at a type already being resolved, so the
 * work stays linear in the input.
 */
import type { ImportedShape } from "./schema-import-fields.js";
import type { TsDeclaration, TsMember, TsType } from "./typescript-type-ast.js";

const UNKNOWN: ImportedShape = { kind: "unknown" };
const OBJECT: ImportedShape = { kind: "object" };
const ARRAY: ImportedShape = { kind: "array" };
const KEYWORD_SHAPES: ReadonlyMap<string, ImportedShape> = new Map([
	["string", { kind: "string" }],
	["number", { kind: "number" }],
	["bigint", { kind: "number" }],
	["boolean", { kind: "boolean" }],
	["any", OBJECT],
	["unknown", OBJECT],
	["object", OBJECT],
]);
/** Global types read by name when the input does not declare them. */
const BUILTIN_SHAPES: ReadonlyMap<string, ImportedShape> = new Map([
	["Date", { kind: "date" }],
	["String", { kind: "string" }],
	["Number", { kind: "number" }],
	["Boolean", { kind: "boolean" }],
	...["Array", "ReadonlyArray", "Set", "ReadonlySet"].map(
		(name) => [name, ARRAY] as const,
	),
	...[
		"Record",
		"Map",
		"ReadonlyMap",
		"Object",
		"Partial",
		"Required",
		"Readonly",
		"Pick",
		"Omit",
	].map((name) => [name, OBJECT] as const),
]);
const NOTHING = new Set(["null", "undefined", "void", "never"]);

export class TypeResolver {
	private readonly shapes = new Map<string, ImportedShape>();
	private readonly resolving = new Set<string>();

	constructor(
		private readonly declarations: ReadonlyMap<string, TsDeclaration>,
	) {}

	/** Fields of a declaration after `extends` and `&`; `null` if not an object. */
	membersOf(decl: TsDeclaration, seen = new Set<string>()): TsMember[] | null {
		if (seen.has(decl.name)) return null;
		seen.add(decl.name);
		const bases = decl.bases.map((name): TsType => ({ kind: "ref", name }));
		return this.merge([...bases, decl.type], seen);
	}

	private merge(
		types: readonly TsType[],
		seen: Set<string>,
	): TsMember[] | null {
		// A later declaration of a name replaces the earlier one in place.
		const byName = new Map<string, TsMember>();
		let isObject = false;
		for (const type of types) {
			const members = this.objectMembers(type, seen);
			if (members === null) continue;
			isObject = true;
			for (const member of members) byName.set(member.name, member);
		}
		return isObject ? [...byName.values()] : null;
	}

	private objectMembers(type: TsType, seen: Set<string>): TsMember[] | null {
		if (type.kind === "object") return [...type.members];
		if (type.kind === "intersection") return this.merge(type.types, seen);
		if (type.kind !== "ref") return null;
		const decl = this.declarations.get(type.name);
		return decl === undefined ? null : this.membersOf(decl, seen);
	}

	/** Shape of a field type; `null` for functions, which are skipped. */
	shape(type: TsType): ImportedShape | null {
		switch (type.kind) {
			case "keyword":
				return KEYWORD_SHAPES.get(type.name) ?? UNKNOWN;
			case "literal":
				return typeof type.value === "boolean"
					? { kind: "boolean" }
					: { kind: "enum", values: [type.value] };
			case "array":
				return ARRAY;
			case "object":
			case "intersection":
				return OBJECT;
			case "function":
				return null;
			case "other":
				return UNKNOWN;
			case "union":
				return this.union(type.types);
			case "ref":
				return this.ref(type.name);
		}
	}

	/** `T | null` is `T`; literal unions are enums; mixed unions keep the first type. */
	private union(types: readonly TsType[]): ImportedShape | null {
		const shapes: ImportedShape[] = [];
		for (const type of types) {
			if (type.kind === "keyword" && NOTHING.has(type.name)) continue;
			const shape = this.shape(type);
			if (shape !== null) shapes.push(shape);
		}
		const plain = shapes.find((shape) => shape.kind !== "enum");
		if (plain !== undefined) return plain;
		const values = shapes.flatMap((shape) => shape.values ?? []);
		return values.length === 0 ? UNKNOWN : { kind: "enum", values };
	}

	/** Memoised so aliases used many times are resolved once. */
	private ref(name: string): ImportedShape | null {
		const decl = this.declarations.get(name);
		if (decl === undefined) return BUILTIN_SHAPES.get(name) ?? UNKNOWN;
		if (decl.bases.length > 0) return OBJECT;
		const known = this.shapes.get(name);
		if (known !== undefined) return known;
		if (this.resolving.has(name)) return OBJECT; // recursive type
		this.resolving.add(name);
		const shape = this.shape(decl.type);
		this.resolving.delete(name);
		if (shape !== null) this.shapes.set(name, shape);
		return shape;
	}
}
