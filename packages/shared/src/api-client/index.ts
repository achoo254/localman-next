/**
 * `@localman/shared/api-client`: pure logic of the API client shared by the
 * web app (direct sends, router, UI) and the API (proxy, MCP `send_request`).
 * No DOM and no Node-only API. Only `request-schema.ts` and
 * `proxy-envelope.ts` import zod; the web bundle drops them when unused.
 */
export * from "./auth-headers.js";
export * from "./byte-encoding.js";
export * from "./dynamic-variables.js";
export * from "./extract-variables.js";
export * from "./header-rules.js";
export * from "./limits.js";
export * from "./local-host.js";
export * from "./multipart-encoder.js";
export * from "./prepare-body.js";
export * from "./prepare-error.js";
export * from "./proxy-envelope.js";
export * from "./request-model.js";
export * from "./request-preparer.js";
export * from "./request-schema.js";
export * from "./response-model.js";
export * from "./tunnel-url.js";
export * from "./url-params.js";
export * from "./variable-interpolation.js";
// Import (cURL, Collection v2.1, OpenAPI 3.x JSON), export, code snippets.
export { exportCollectionV21 } from "./export/collection-v21-export.js";
export { type OpenApiExport, exportOpenApi } from "./export/openapi-export.js";
export { applyCollectionVariables } from "./import/apply-collection-variables.js";
export type { CollectionV21 } from "./import/collection-v21-types.js";
export {
	type CurlImport,
	looksLikeCurl,
	parseCurlCommand,
} from "./import/curl-parser.js";
export type { ImportFormat } from "./import/detect-format.js";
export {
	MAX_IMPORT_ITEMS,
	type RequestImportOptions,
} from "./import/import-context.js";
export {
	REQUEST_IMPORT_ERROR_CODES,
	REQUEST_IMPORT_WARNING_CODES,
	type RequestImportError,
	type RequestImportErrorCode,
	type RequestImportParams,
	type RequestImportResult,
	type RequestImportWarning,
	type RequestImportWarningCode,
} from "./import/import-error.js";
export { MAX_IMPORT_BYTES } from "./import/import-json.js";
export { importText } from "./import/import-text.js";
export * from "./import/imported-collection.js";
export type { SnippetRequest } from "./snippets/snippet-input.js";
export * from "./snippets/snippet-registry.js";
export * from "./collections/collection-model.js";
export * from "./collections/request-context.js";
export * from "./collections/collection-order.js";
export * from "./collections/collection-tree.js";
