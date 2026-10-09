/**
 * Files the export menu writes: a Collection v2.1, an OpenAPI 3.0 document
 * or an environment file, as pretty JSON. Secret variable values are never
 * written; the files may be shared.
 */
import {
	type ApiRequestDraft,
	type VariableEntry,
	collectionFromDrafts,
	exportCollectionV21,
	exportOpenApi,
} from "@localman/shared/api-client";

export interface ExportFile {
	filename: string;
	json: string;
	/** OpenAPI only: requests left out (same method and path as another). */
	skipped: number;
}

export interface ExportableEnvironment {
	name: string;
	variables: readonly VariableEntry[];
}

/** `My API` → `my-api`; never empty. */
export function fileSlug(name: string): string {
	const slug = name
		.normalize("NFKD")
		.replace(/\p{M}+/gu, "")
		.replace(/\u0111/gi, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return slug || "localman";
}

const pretty = (value: unknown): string =>
	`${JSON.stringify(value, null, 2)}\n`;

export function collectionFile(
	name: string,
	requests: readonly { id: string; draft: ApiRequestDraft }[],
): ExportFile {
	const tree = collectionFromDrafts(name, requests);
	return {
		filename: `${fileSlug(name)}.collection.json`,
		json: pretty(exportCollectionV21(tree)),
		skipped: 0,
	};
}

export function openApiFile(
	name: string,
	requests: readonly { id: string; draft: ApiRequestDraft }[],
): ExportFile {
	const { document, skipped } = exportOpenApi(
		collectionFromDrafts(name, requests),
	);
	return {
		filename: `${fileSlug(name)}.openapi.json`,
		json: pretty(document),
		skipped,
	};
}

/** The v2.1 environment shape the importer reads back; secrets left empty. */
export function environmentFile(
	environment: ExportableEnvironment,
): ExportFile {
	const values = environment.variables.map((variable) => ({
		key: variable.key,
		value: variable.secret ? "" : variable.value,
		type: variable.secret ? "secret" : "default",
		enabled: variable.enabled !== false,
	}));
	return {
		filename: `${fileSlug(environment.name)}.environment.json`,
		json: pretty({ name: environment.name, values }),
		skipped: 0,
	};
}
