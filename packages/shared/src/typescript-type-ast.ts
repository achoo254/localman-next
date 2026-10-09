/**
 * Types the TypeScript importer reads (`typescript-type-parser.ts`) and
 * maps (`typescript-type-resolver.ts`). Generic arguments, tuples and
 * function signatures are not kept: the field type is all that matters.
 */
export type TsType =
	| { readonly kind: "keyword"; readonly name: string }
	| { readonly kind: "literal"; readonly value: string | number | boolean }
	| { readonly kind: "object"; readonly members: readonly TsMember[] }
	| { readonly kind: "union" | "intersection"; readonly types: TsType[] }
	| { readonly kind: "ref"; readonly name: string }
	| { readonly kind: "array" | "function" | "other" };

export interface TsMember {
	readonly name: string;
	readonly type: TsType;
}

export interface TsDeclaration {
	readonly name: string;
	readonly type: TsType;
	/** Interfaces named after `extends`. */
	readonly bases: readonly string[];
}
