import {
	FIELD_NAME_MAX,
	FIELD_NAME_PATTERN,
	FORBIDDEN_KEYS,
	MAX_SCHEMA_FIELDS,
	MOCK_MCP_SEGMENT,
	OBJECT_ID_FIELD,
	RESERVED_RESOURCE_NAMES,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
	relationSourceOf,
} from "@localman/shared/constants";
import { isFakerMethodId } from "@localman/shared/faker-catalog";
import type { Translate } from "../../i18n/translate";
import { isRecord } from "../../lib/json-guards";
import { parseJsonText } from "../../lib/json-text";
import { checkBehavior } from "./endpoint-behavior-validation";
import {
	type DraftErrors,
	type FieldDraft,
	type FormPlace,
	type ResourceDraft,
	endpointKey,
} from "./resource-form-state";
import type {
	ResourceEndpoint,
	ResourceInput,
	SchemaField,
} from "./resource-model";

export function resourceNameError(
	name: string,
	place: FormPlace,
	t: Translate,
): string | undefined {
	if (name === "") return t("resources.validation.nameRequired");
	if (name.length > RESOURCE_NAME_MAX) {
		return t("resources.validation.nameTooLong", { max: RESOURCE_NAME_MAX });
	}
	if (!RESOURCE_NAME_PATTERN.test(name)) {
		return t("resources.validation.namePattern");
	}
	if (RESERVED_RESOURCE_NAMES.includes(name)) {
		return t("resources.validation.nameReserved", { name: MOCK_MCP_SEGMENT });
	}
	if (place.siblingNames.includes(name)) {
		return t("resources.errors.nameTaken");
	}
	return undefined;
}

/** Names already used, and the first field reading each relation source. */
interface SeenFields {
	readonly names: Set<string>;
	readonly sources: Map<string, string>;
	readonly t: Translate;
}

/** A second field reading the same parent or child would repeat its records. */
function repeatedSourceError(
	field: FieldDraft,
	name: string,
	{ sources, t }: SeenFields,
): string | undefined {
	const source = relationSourceOf(field);
	if (source === null) return undefined;
	const first = sources.get(source);
	if (first === undefined) {
		sources.set(source, name);
		return undefined;
	}
	return field.type === "Parent Resource"
		? t("resources.validation.parentRepeated", { first })
		: t("resources.validation.childRepeated", { first });
}

function fieldError(
	field: FieldDraft,
	reserved: ReadonlySet<string>,
	seen: SeenFields,
	place: FormPlace,
): string | undefined {
	const { t } = seen;
	const name = field.name.trim();
	if (name === "") return t("resources.validation.fieldRequired");
	if (name.length > FIELD_NAME_MAX) {
		return t("resources.validation.fieldTooLong", { max: FIELD_NAME_MAX });
	}
	if (!FIELD_NAME_PATTERN.test(name)) {
		return t("resources.validation.fieldPattern");
	}
	if (FORBIDDEN_KEYS.includes(name)) {
		return t("resources.validation.fieldForbidden", { name });
	}
	if (reserved.has(name)) {
		return t("resources.validation.fieldGenerated", { name });
	}
	if (seen.names.has(name)) {
		return t("resources.validation.fieldDuplicate", { name });
	}
	seen.names.add(name);
	if (field.type === "Faker.js" && !isFakerMethodId(field.fakerMethod)) {
		return t("resources.validation.fakerMethod");
	}
	if (
		field.type === "Child Resource" &&
		!place.children.some((child) => child.id === field.childId)
	) {
		return t("resources.validation.childRequired");
	}
	if (field.type === "Parent Resource" && place.parentKey === null) {
		return t("resources.validation.parentOnRoot");
	}
	return repeatedSourceError(field, name, seen);
}

function toField(field: FieldDraft): SchemaField {
	return {
		name: field.name.trim(),
		type: field.type,
		...(field.type === "Faker.js" ? { fakerMethod: field.fakerMethod } : {}),
		...(field.type === "Child Resource" ? { childId: field.childId } : {}),
	};
}

/**
 * Checks the draft like the API does (names, reserved fields, Faker ids,
 * JSON) and builds the body to send. Template references are left to the
 * API, which knows the allowed variables.
 */
export function validateDraft(
	draft: ResourceDraft,
	place: FormPlace,
	t: Translate,
): { input: ResourceInput | null; errors: DraftErrors } {
	const errors: DraftErrors = { fields: {}, endpoints: {}, behavior: {} };
	const name = draft.name.trim();
	errors.name = resourceNameError(name, place, t);
	if (draft.fields.length > MAX_SCHEMA_FIELDS) {
		errors.schema = t("resources.validation.tooManyFields", {
			max: MAX_SCHEMA_FIELDS,
		});
	}
	const reserved = new Set([
		OBJECT_ID_FIELD,
		...(place.parentKey ? [place.parentKey] : []),
	]);
	const seen: SeenFields = { names: new Set(), sources: new Map(), t };
	for (const field of draft.fields) {
		const error = fieldError(field, reserved, seen, place);
		if (error) errors.fields[field.key] = error;
	}
	let template: Record<string, unknown> | null = null;
	if (draft.template.trim() !== "") {
		const parsed = parseJsonText(draft.template);
		if (!parsed.ok) errors.template = t("resources.validation.templateInvalid");
		else if (!isRecord(parsed.value)) {
			errors.template = t("resources.validation.templateNotObject");
		} else template = parsed.value;
	}
	const endpoints: ResourceEndpoint[] = [];
	for (const endpoint of draft.endpoints) {
		const key = endpointKey(endpoint);
		const { errors: behaviorErrors, ...behavior } = checkBehavior(endpoint, t);
		if (behaviorErrors) errors.behavior[key] = behaviorErrors;
		const parsed = parseJsonText(endpoint.response);
		if (!parsed.ok) {
			errors.endpoints[key] = t("resources.validation.responseInvalid");
			continue;
		}
		const { method, path, enabled } = endpoint;
		endpoints.push({
			method,
			path,
			enabled,
			response: parsed.value,
			...behavior,
		});
	}
	const failed =
		errors.name !== undefined ||
		errors.schema !== undefined ||
		errors.template !== undefined ||
		Object.keys(errors.fields).length > 0 ||
		Object.keys(errors.endpoints).length > 0 ||
		Object.keys(errors.behavior).length > 0;
	if (failed) return { input: null, errors };
	return {
		input: { name, schema: draft.fields.map(toField), template, endpoints },
		errors,
	};
}
