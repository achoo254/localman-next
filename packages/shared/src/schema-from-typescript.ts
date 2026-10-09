/**
 * Localman schema fields from pasted TypeScript (`interface`/`type`
 * declarations), for MCP `create_resource` and the import dialog. The
 * input is parsed by `typescript-type-parser.ts`, never evaluated; the
 * result is `{ fields, warnings }` or a structured error, never a throw.
 */
import { utf8Length } from "./json-value.js";
import {
	SchemaImportFailure,
	importFailure,
	paramText,
} from "./schema-import-errors.js";
import {
	FieldCollector,
	type SchemaImportResult,
} from "./schema-import-fields.js";
import type { TsDeclaration } from "./typescript-type-ast.js";
import { parseTypeScriptDeclarations } from "./typescript-type-parser.js";
import { TypeResolver } from "./typescript-type-resolver.js";

export const MAX_TYPESCRIPT_SCHEMA_BYTES = 20 * 1024;

export interface TypeScriptImportOptions {
	/** Declaration to import; defaults to the first object type. */
	readonly name?: string;
}

export function schemaFromTypeScript(
	source: unknown,
	options: TypeScriptImportOptions = {},
): SchemaImportResult {
	try {
		if (typeof source !== "string") {
			throw new SchemaImportFailure(
				"INVALID_INPUT",
				"Expected TypeScript text",
			);
		}
		if (utf8Length(source) > MAX_TYPESCRIPT_SCHEMA_BYTES) {
			throw new SchemaImportFailure(
				"INPUT_TOO_LARGE",
				`TypeScript input is larger than ${MAX_TYPESCRIPT_SCHEMA_BYTES / 1024} KB`,
				{ max: MAX_TYPESCRIPT_SCHEMA_BYTES },
			);
		}
		const fields = new FieldCollector();
		// Every TypeScript warning is about a part that is left out.
		const warn = (path: string, message: string) =>
			fields.warn(path, "SKIPPED", message, { path: paramText(path) });
		const declarations = new Map<string, TsDeclaration>();
		for (const decl of parseTypeScriptDeclarations(source, warn)) {
			if (declarations.has(decl.name)) {
				warn(decl.name, "Declared more than once; the first one is used");
			} else {
				declarations.set(decl.name, decl);
			}
		}
		const resolver = new TypeResolver(declarations);
		const all = [...declarations.values()];
		const chosen =
			options.name === undefined
				? all.find((decl) => resolver.membersOf(decl) !== null)
				: declarations.get(options.name);
		if (chosen === undefined) {
			throw new SchemaImportFailure(
				"SCHEMA_NOT_FOUND",
				options.name === undefined
					? "No interface or object type found"
					: `No declaration named "${options.name}"`,
				options.name === undefined ? {} : { name: paramText(options.name) },
			);
		}
		const members = resolver.membersOf(chosen);
		if (members === null) {
			throw new SchemaImportFailure(
				"UNSUPPORTED",
				`"${chosen.name}" is not an object type`,
			);
		}
		for (const base of chosen.bases) {
			if (!declarations.has(base)) {
				warn(
					chosen.name,
					`"${base}" is not in the input; its fields are missing`,
				);
			}
		}
		for (const member of members) {
			const shape = resolver.shape(member.type);
			if (shape === null) warn(member.name, "Functions are skipped");
			else fields.add(member.name, shape);
		}
		return fields.result(chosen.name);
	} catch (error) {
		return importFailure(error);
	}
}
