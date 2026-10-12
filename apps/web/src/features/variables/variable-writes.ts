/**
 * The variable lists an Editor's "Set as variable" or "Add to" sends: the
 * whole list (the APIs replace it), with one name set.
 */
import type { VariableEntry, VariableView } from "@localman/shared/api-client";
import type { VariableWrite } from "../environments/environments-api";

/**
 * The variables to send with `key` holding `value` as its shared value.
 * An existing variable keeps its id, type and enabled state (a disabled
 * one stays disabled: the form says so before writing).
 */
export function upsertSharedVariable(
	variables: readonly VariableView[],
	rawKey: string,
	value: string,
): VariableWrite[] {
	const key = rawKey.trim();
	const writes = variables.map(
		(variable): VariableWrite => ({
			id: variable.id,
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			// A withheld secret sent back as `null` keeps its stored value.
			sharedValue: variable.key.trim() === key ? value : variable.sharedValue,
		}),
	);
	if (writes.some((write) => write.key.trim() === key)) return writes;
	const added: VariableWrite = {
		key,
		type: "default",
		enabled: true,
		description: "",
		sharedValue: value,
	};
	return [...writes, added];
}

/** Collection variables with `key` set to `value`, enabled state kept. */
export function upsertCollectionVariable(
	variables: readonly VariableEntry[],
	rawKey: string,
	value: string,
): VariableEntry[] {
	const key = rawKey.trim();
	if (!variables.some((variable) => variable.key.trim() === key)) {
		return [...variables, { key, value, enabled: true }];
	}
	return variables.map((variable) =>
		variable.key.trim() === key ? { ...variable, key, value } : variable,
	);
}
