import {
	FIELD_NAME_MAX,
	type JsonObject,
	type ResourceFieldDefinition,
	type SchemaImportWarning,
} from "@localman/shared";

/**
 * Moves `record[from]` to `to`, keeping key order. Never overwrites: a
 * record already holding `to` is a planning bug, not data to lose.
 */
export function renameKey(
	record: JsonObject,
	from: string,
	to: string,
): JsonObject {
	if (from === to || !Object.hasOwn(record, from)) return record;
	if (Object.hasOwn(record, to)) {
		throw new Error(`Renaming "${from}" would overwrite "${to}"`);
	}
	// fromEntries defines own properties: a `__proto__` key stays data.
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [
			key === from ? to : key,
			value,
		]),
	);
}

/** `base_2`, `base_3`… within `FIELD_NAME_MAX`, not in `taken`. */
function freeName(base: string, taken: ReadonlySet<string>): string {
	for (let n = 2; ; n += 1) {
		const suffix = `_${n}`;
		const name = `${base.slice(0, FIELD_NAME_MAX - suffix.length)}${suffix}`;
		if (!taken.has(name)) return name;
	}
}

export interface FreedParentKey {
	readonly fields: readonly ResourceFieldDefinition[];
	/** New name of the field that held `key`, `null` when none did. */
	readonly renamedTo: string | null;
	readonly warnings: readonly SchemaImportWarning[];
}

/**
 * Makes room for the parent link `key` (`{parent}Id` under the parent's
 * final name) in a nested resource's `fields`. Renaming the parent can
 * make the link collide with a field of the source (`authorId` once
 * `users` becomes `authors`): that field becomes `authorId_2`, with a
 * `RENAMED` warning at `{resource}.{key}`, so neither value is lost.
 */
export function freeParentKey(
	resource: string,
	fields: readonly ResourceFieldDefinition[],
	key: string,
): FreedParentKey {
	if (!fields.some((field) => field.name === key)) {
		return { fields, renamedTo: null, warnings: [] };
	}
	const taken = new Set([key, ...fields.map((field) => field.name)]);
	const renamedTo = freeName(key, taken);
	return {
		fields: fields.map((field) =>
			field.name === key ? { ...field, name: renamedTo } : field,
		),
		renamedTo,
		warnings: [
			{
				path: `${resource}.${key}`,
				code: "RENAMED",
				params: { from: key, to: renamedTo },
				message: `Field renamed to "${renamedTo}": "${key}" now links to the parent`,
			},
		],
	};
}
