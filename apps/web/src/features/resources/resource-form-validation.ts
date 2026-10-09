import {
	FIELD_NAME_MAX,
	FIELD_NAME_PATTERN,
	FORBIDDEN_KEYS,
	MAX_SCHEMA_FIELDS,
	OBJECT_ID_FIELD,
	RESOURCE_NAME_MAX,
	RESOURCE_NAME_PATTERN,
} from "@localman/shared/constants";
import { isFakerMethodId } from "@localman/shared/faker-catalog";
import { isRecord } from "../../lib/json-guards";
import { parseJsonText } from "../../lib/json-text";
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

function nameError(name: string, place: FormPlace): string | undefined {
	if (name === "") return "Nhập tên resource.";
	if (name.length > RESOURCE_NAME_MAX) {
		return `Tên tối đa ${RESOURCE_NAME_MAX} ký tự.`;
	}
	if (!RESOURCE_NAME_PATTERN.test(name)) {
		return "Chỉ dùng chữ không dấu, số, - và _, bắt đầu bằng chữ hoặc số.";
	}
	if (place.siblingNames.includes(name)) {
		return "Đã có resource cùng tên ở vị trí này.";
	}
	return undefined;
}

function fieldError(
	field: FieldDraft,
	reserved: ReadonlySet<string>,
	seen: Set<string>,
	place: FormPlace,
): string | undefined {
	const name = field.name.trim();
	if (name === "") return "Nhập tên field.";
	if (name.length > FIELD_NAME_MAX)
		return `Tên field tối đa ${FIELD_NAME_MAX} ký tự.`;
	if (!FIELD_NAME_PATTERN.test(name)) {
		return "Tên field chỉ gồm chữ không dấu, số, _, - và dấu chấm.";
	}
	if (FORBIDDEN_KEYS.includes(name)) return `Không dùng được tên “${name}”.`;
	if (reserved.has(name)) return `Field “${name}” được sinh tự động.`;
	if (seen.has(name)) return `Field “${name}” bị trùng.`;
	seen.add(name);
	if (field.type === "Faker.js" && !isFakerMethodId(field.fakerMethod)) {
		return "Chọn một Faker method trong danh sách.";
	}
	if (
		field.type === "Child Resource" &&
		!place.children.some((child) => child.id === field.childId)
	) {
		return "Chọn resource con.";
	}
	if (field.type === "Parent Resource" && place.parentKey === null) {
		return "Resource gốc không có Parent Resource.";
	}
	return undefined;
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
): { input: ResourceInput | null; errors: DraftErrors } {
	const errors: DraftErrors = { fields: {}, endpoints: {} };
	const name = draft.name.trim();
	errors.name = nameError(name, place);
	if (draft.fields.length > MAX_SCHEMA_FIELDS) {
		errors.schema = `Mỗi resource có tối đa ${MAX_SCHEMA_FIELDS} field.`;
	}
	const reserved = new Set([
		OBJECT_ID_FIELD,
		...(place.parentKey ? [place.parentKey] : []),
	]);
	const seen = new Set<string>();
	for (const field of draft.fields) {
		const error = fieldError(field, reserved, seen, place);
		if (error) errors.fields[field.key] = error;
	}
	let template: Record<string, unknown> | null = null;
	if (draft.template.trim() !== "") {
		const parsed = parseJsonText(draft.template);
		if (!parsed.ok) errors.template = "Object template không phải JSON hợp lệ.";
		else if (!isRecord(parsed.value)) {
			errors.template = "Object template phải là một object JSON.";
		} else template = parsed.value;
	}
	const endpoints: ResourceEndpoint[] = [];
	for (const endpoint of draft.endpoints) {
		const parsed = parseJsonText(endpoint.response);
		if (!parsed.ok) {
			errors.endpoints[endpointKey(endpoint)] =
				"Response template không phải JSON hợp lệ.";
			continue;
		}
		endpoints.push({ ...endpoint, response: parsed.value });
	}
	const failed =
		errors.name !== undefined ||
		errors.schema !== undefined ||
		errors.template !== undefined ||
		Object.keys(errors.fields).length > 0 ||
		Object.keys(errors.endpoints).length > 0;
	if (failed) return { input: null, errors };
	return {
		input: { name, schema: draft.fields.map(toField), template, endpoints },
		errors,
	};
}
