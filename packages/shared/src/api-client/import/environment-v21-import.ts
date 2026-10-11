/**
 * Environment files in the v2.1 format: `{ name, values: [{ key, value,
 * type, enabled }] }`. Phase 13 stores environments; until then the
 * variables can be applied to imported requests.
 */
import type { VariableEntry } from "../variable-interpolation.js";
import { isSecretVariable } from "./collection-v21-extension.js";
import type { ImportContext } from "./import-context.js";
import { RequestImportFailure } from "./import-error.js";
import { listProp, prop, textOf, textProp } from "./import-json.js";
import type { ImportedEnvironment } from "./imported-collection.js";

/** Collection `variable` or environment `values`: keyed entries only. */
export function readVariables(list: readonly unknown[]): VariableEntry[] {
	return list
		.filter((entry) => textOf(prop(entry, "key")) !== null)
		.map((entry) => ({
			key: textProp(entry, "key"),
			value: textProp(entry, "value"),
			secret: isSecretVariable(entry),
			enabled:
				prop(entry, "enabled") !== false && prop(entry, "disabled") !== true,
		}));
}

/** An object with a `values` array (checked by `detect-format.ts`). */
export function environmentV21ToData(
	value: unknown,
	ctx: ImportContext,
): ImportedEnvironment {
	if (!Array.isArray(prop(value, "values"))) {
		throw new RequestImportFailure("INVALID_DOCUMENT", { path: "values" });
	}
	return {
		format: "environment-v21",
		name: textProp(value, "name"),
		variables: readVariables(listProp(value, "values")),
		warnings: ctx.warnings(),
	};
}
