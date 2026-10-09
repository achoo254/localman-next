/**
 * `@localman/shared/constants`: limits, field and endpoint lists and pure
 * helpers with no zod and no Faker catalog, for clients that must stay
 * light. Everything here is also exported by the package root.
 */
export {
	FREE_LIMITS,
	limitsFor,
	MAX_RECORD_BYTES,
	MAX_RESOURCE_BYTES,
	PLAN_LIMITS,
	PRO_LIMITS,
	type PlanId,
	type PlanLimits,
} from "./plan-limits.js";
export { DEFAULT_JSON_LIMITS, FORBIDDEN_KEYS } from "./json-value.js";
export {
	DEFAULT_GENERATE_COUNT,
	DEFAULT_RESOURCE_FIELDS,
	DEFAULT_RESPONSE,
	ENDPOINT_METHODS,
	ENDPOINT_PATHS,
	FIELD_NAME_MAX,
	FIELD_NAME_PATTERN,
	FIELD_TYPES,
	type FieldType,
	MAX_GENERATE_COUNT,
	MAX_RECORDS_PER_RESOURCE,
	MAX_RESOURCE_DEPTH,
	MAX_SCHEMA_FIELDS,
	OBJECT_ID_FIELD,
	OBJECT_ID_PATTERN,
	parentKeyOf,
	MOCK_MCP_SEGMENT,
	RECORD_ID_MAX,
	RELATION_FIELD_TYPES,
	relationSourceOf,
	RESOURCE_ENDPOINTS,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
	RESERVED_RESOURCE_NAMES,
	type ResourceFieldDefinition,
} from "./resource-constants.js";
export {
	MAX_JSON_BODY_KB,
	MAX_PAGE_LIMIT,
	MOCK_QUERY_PARAMS,
} from "./mock-query.js";
export {
	isMockToolEnabled,
	MOCK_TOOL_ACTIONS,
	MOCK_TOOL_ENDPOINTS,
	MOCK_TOOL_NAME_PATTERN,
	type MockToolAction,
	type MockToolEntry,
	type MockToolNode,
	mockToolEntries,
	mockToolSlug,
} from "./mock-tool-names.js";
export {
	MAX_OPENAPI_BYTES,
	type OpenApiImportOptions,
	openApiSchemaNames,
	readOpenApiInput,
} from "./openapi-document.js";
export {
	type OpenApiImportResult,
	type OpenApiReference,
	schemaFromOpenApi,
} from "./schema-from-openapi.js";
export {
	MAX_TYPESCRIPT_SCHEMA_BYTES,
	schemaFromTypeScript,
	type TypeScriptImportOptions,
} from "./schema-from-typescript.js";
export type {
	SchemaImportError,
	SchemaImportErrorCode,
	SchemaImportResult,
	SchemaImportSuccess,
	SchemaImportWarning,
} from "./schema-import-fields.js";
export {
	CONTACT_CATEGORIES,
	CONTACT_EMAIL_PATTERN,
	CONTACT_HANDLE_MAX,
	CONTACT_MESSAGE_MAX,
	CONTACT_NAME_MAX,
	CONTACT_SOURCES,
	CONTACT_STATUSES,
	type ContactCategory,
	type ContactSource,
	type ContactStatus,
	TELEGRAM_USERNAME_PATTERN,
	TURNSTILE_ACTIONS,
	type TurnstileAction,
} from "./feedback-constants.js";
