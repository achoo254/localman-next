/**
 * State shared by the inference sources of `schema-inference.ts`: the
 * resources found so far (parents before children), unique resource
 * names, the cap on resources, and warnings capped in number.
 */
import type { JsonObject } from "./json-value.js";
import {
	RESERVED_RESOURCE_NAMES,
	RESOURCE_NAME_MAX,
	type ResourceFieldDefinition,
} from "./resource-constants.js";
import {
	type ImportParams,
	SchemaImportFailure,
	type SchemaImportWarning,
	type SchemaImportWarningCode,
	paramText,
} from "./schema-import-errors.js";

/** Resources one import may propose; the plan quota applies when saving. */
export const MAX_INFERRED_RESOURCES = 50;
/** Warnings kept; later ones are only counted. */
export const MAX_INFERENCE_WARNINGS = 100;
export const DEFAULT_INFERRED_NAME = "items";

export interface InferredResource {
	/** Unique across the import, valid as `RESOURCE_NAME_PATTERN`. */
	readonly name: string;
	/** Name of the parent resource in the same import, `null` for a root. */
	readonly parentName: string | null;
	/**
	 * Field of the parent that held this resource's items, removed from the
	 * parent's schema; a candidate for a Child Resource field once both
	 * resources exist.
	 */
	readonly parentField?: string;
	readonly fields: readonly ResourceFieldDefinition[];
	/**
	 * Seed records (JSON and CSV only): `id`, the `{parent}Id` key on a
	 * nested resource, then schema fields.
	 */
	readonly records?: readonly JsonObject[];
	/** OpenAPI only: the `components.schemas` entry it came from. */
	readonly source?: string;
}

/** Characters outside `RESOURCE_NAME_PATTERN` become `_`. */
export function normalizeResourceName(raw: string): string {
	const name = raw
		.trim()
		.replace(/[^\w-]/g, "_")
		.replace(/^[_-]+/, "")
		.slice(0, RESOURCE_NAME_MAX);
	return name === "" ? DEFAULT_INFERRED_NAME : name;
}

export class InferenceContext {
	readonly resources: InferredResource[] = [];
	private readonly warnings: SchemaImportWarning[] = [];
	private hiddenWarnings = 0;
	private readonly names = new Set<string>(RESERVED_RESOURCE_NAMES);
	private slots = 0;

	warn(
		path: string,
		code: SchemaImportWarningCode,
		message: string,
		params: ImportParams = {},
	): void {
		if (this.warnings.length < MAX_INFERENCE_WARNINGS) {
			this.warnings.push({ path, code, params, message });
		} else {
			this.hiddenWarnings += 1;
		}
	}

	/** Field warnings of `resource`, their paths prefixed with its name. */
	addWarnings(
		resource: string,
		warnings: readonly SchemaImportWarning[],
	): void {
		for (const { path, code, params, message } of warnings) {
			const where = path === "" ? resource : `${resource}.${path}`;
			this.warn(where, code, message, params);
		}
	}

	/** Takes a resource slot; `false` once `MAX_INFERRED_RESOURCES` are taken. */
	reserve(): boolean {
		if (this.slots >= MAX_INFERRED_RESOURCES) return false;
		this.slots += 1;
		return true;
	}

	release(): void {
		this.slots -= 1;
	}

	/** A normalized name not used yet in this import (`posts_2`…). */
	resourceName(raw: string): string {
		const base = normalizeResourceName(raw);
		let name = base;
		for (let n = 2; this.names.has(name); n += 1) {
			const suffix = `_${n}`;
			name = `${base.slice(0, RESOURCE_NAME_MAX - suffix.length)}${suffix}`;
		}
		this.names.add(name);
		if (name !== raw) {
			this.warn(raw, "RENAMED", `Resource renamed to "${name}"`, {
				from: paramText(raw),
				to: name,
			});
		}
		return name;
	}

	finish(): {
		readonly ok: true;
		readonly resources: readonly InferredResource[];
		readonly warnings: readonly SchemaImportWarning[];
	} {
		if (this.resources.every((resource) => resource.fields.length === 0)) {
			throw new SchemaImportFailure(
				"NO_FIELDS",
				"No fields could be inferred from the input",
			);
		}
		const warnings = [...this.warnings];
		if (this.hiddenWarnings > 0) {
			const count = this.hiddenWarnings;
			warnings.push({
				path: "",
				code: "MORE_WARNINGS",
				params: { count },
				message: `${count} more warnings not shown`,
			});
		}
		return { ok: true, resources: this.resources, warnings };
	}
}
