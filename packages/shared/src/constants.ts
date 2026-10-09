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
export { FORBIDDEN_KEYS } from "./json-value.js";
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
	RECORD_ID_MAX,
	RELATION_FIELD_TYPES,
	RESOURCE_ENDPOINTS,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
	type ResourceFieldDefinition,
} from "./resource-constants.js";
