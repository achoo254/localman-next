/**
 * Entry of the import dialog: text in (pasted or read from a file, at most
 * 10 MB), a collection tree or an environment out. Never throws: errors
 * and warnings are codes the web app translates.
 */
import { collectionV21ToTree } from "./collection-v21-import.js";
import { curlToDraft } from "./curl-parser.js";
import { detectJsonFormat, detectTextFormat } from "./detect-format.js";
import { environmentV21ToData } from "./environment-v21-import.js";
import { fitTree } from "./fit-tree.js";
import {
	type ImportContext,
	type RequestImportOptions,
	createImportContext,
} from "./import-context.js";
import { type RequestImportResult, runImport } from "./import-error.js";
import { checkImportText, isRecord, parseImportJson } from "./import-json.js";
import type {
	ImportedCollection,
	ImportedData,
} from "./imported-collection.js";
import { openApiToTree } from "./openapi-import.js";

function curlCollection(text: string, ctx: ImportContext): ImportedCollection {
	const draft = curlToDraft(text, ctx);
	return {
		format: "curl",
		name: draft.name,
		description: "",
		auth: { type: "none" },
		variables: [],
		scripts: { pre: "", post: "" },
		items: [
			{
				kind: "request",
				id: ctx.newId(),
				name: draft.name,
				description: "",
				draft,
				examples: [],
			},
		],
		tags: [],
		status: null,
		warnings: ctx.warnings(),
	};
}

/** The collection fitted to the server limits, with every warning. */
function fitted(
	collection: ImportedCollection,
	ctx: ImportContext,
): ImportedCollection {
	return { ...fitTree(collection, ctx), warnings: ctx.warnings() };
}

/**
 * Detects the format and imports. Error codes: `INPUT_TOO_LARGE`,
 * `EMPTY_INPUT`, `INVALID_JSON`, `YAML_NOT_SUPPORTED`, `UNKNOWN_FORMAT`,
 * `UNSUPPORTED_VERSION`, `INVALID_CURL`, `UNTERMINATED_QUOTE`,
 * `INVALID_DOCUMENT`, `TOO_COMPLEX`.
 */
export function importText(
	text: string,
	options: RequestImportOptions = {},
): RequestImportResult<ImportedData> {
	return runImport((): ImportedData => {
		const ctx = createImportContext(options);
		const trimmed = checkImportText(text);
		if (detectTextFormat(trimmed) === "curl") {
			return fitted(curlCollection(trimmed, ctx), ctx);
		}
		const value = parseImportJson(trimmed);
		switch (detectJsonFormat(value)) {
			case "collection-v21":
				return fitted(collectionV21ToTree(value, ctx), ctx);
			case "environment-v21":
				return environmentV21ToData(value, ctx);
			case "openapi":
				return fitted(openApiToTree(isRecord(value) ? value : {}, ctx), ctx);
			case "curl":
				return fitted(curlCollection(trimmed, ctx), ctx);
		}
	});
}
