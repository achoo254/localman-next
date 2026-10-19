import type {
	SharedVariable,
	VariableInput,
	VariableView,
} from "@localman/shared/api-client";
import { Schema, Types } from "mongoose";
import { openSecret, sealSecret, sharedSlot } from "./secret-cipher.js";

/**
 * A variable as environments and globals store it. `value` is the shared
 * value, sealed (`secret-cipher.ts`) when the variable is a secret.
 */
export interface StoredVariable {
	readonly id: string;
	readonly key: string;
	readonly type: SharedVariable["type"];
	readonly enabled: boolean;
	readonly description: string;
	readonly value: string | null;
	readonly sealed: boolean;
}

export const storedVariableSchema = new Schema(
	{
		id: { type: String, required: true },
		key: { type: String, required: true },
		type: { type: String, enum: ["default", "secret"], required: true },
		enabled: { type: Boolean, required: true },
		description: { type: String, default: "" },
		value: { type: String, default: null },
		sealed: { type: Boolean, default: false },
	},
	{ _id: false },
);

/** A sealed shared value the server cannot open now (its key is missing). */
function unreadable(variable: StoredVariable, scope: string): boolean {
	return variable.sealed && sharedValueOf(variable, scope) === null;
}

/**
 * The stored variable an input stands for: by id, else (for an agent's
 * write) by name, unless another input claims that variable's id.
 */
function matcher(
	inputs: readonly VariableInput[],
	previous: readonly StoredVariable[],
	byName: boolean,
): (input: VariableInput) => StoredVariable | undefined {
	const known = new Map(previous.map((variable) => [variable.id, variable]));
	const named = new Map(previous.map((variable) => [variable.key, variable]));
	const claimed = new Set(inputs.map((input) => input.id));
	return (input) => {
		const byId = input.id ? known.get(input.id) : undefined;
		if (byId || !byName) return byId;
		const same = named.get(input.key);
		return same && !claimed.has(same.id) ? same : undefined;
	};
}

/**
 * The variables an Editor sent, ready to store in `scope`: listed ids are
 * kept when they exist, others get a new one; secret values are sealed.
 * A secret whose value cannot be opened now reads as hidden to everyone,
 * so a `null` sent back for it keeps the stored value instead of erasing
 * it until the key returns. With `keepWithheld` (an agent, which reads
 * every secret withheld), a secret sent back as `sharedValue: null` keeps
 * its stored value the same way; a real value still replaces it.
 */
export function toStoredVariables(
	inputs: readonly VariableInput[],
	previous: readonly StoredVariable[],
	scope: string,
	keepWithheld = false,
): StoredVariable[] {
	const match = matcher(inputs, previous, keepWithheld);
	return inputs.map((input): StoredVariable => {
		const before = match(input);
		const id = before?.id ?? new Types.ObjectId().toHexString();
		const withheld =
			before !== undefined &&
			(unreadable(before, scope) ||
				(keepWithheld && before.type === "secret" && before.value !== null));
		if (
			before &&
			withheld &&
			input.type === "secret" &&
			input.sharedValue === null
		) {
			return {
				...before,
				key: input.key,
				enabled: input.enabled,
				description: input.description,
			};
		}
		const secret = input.type === "secret" && input.sharedValue !== null;
		return {
			id,
			key: input.key,
			type: input.type,
			enabled: input.enabled,
			description: input.description,
			value: secret
				? sealSecret(input.sharedValue ?? "", sharedSlot(scope, id))
				: input.sharedValue,
			sealed: secret,
		};
	});
}

/** The plaintext shared value; `null` for an unshared or unreadable one. */
export function sharedValueOf(
	variable: StoredVariable,
	scope: string,
): string | null {
	if (variable.value === null) return null;
	return variable.sealed
		? openSecret(variable.value, sharedSlot(scope, variable.id))
		: variable.value;
}

/**
 * Variables as the caller sees them. Without `revealSecrets` (a Viewer),
 * a secret's shared value is withheld: `sharedHidden` says it exists.
 */
export function toVariableViews(
	stored: readonly StoredVariable[],
	scope: string,
	revealSecrets: boolean,
): VariableView[] {
	return stored.map((variable) => {
		const withheld =
			(variable.type === "secret" &&
				variable.value !== null &&
				!revealSecrets) ||
			unreadable(variable, scope);
		return {
			id: variable.id,
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			sharedValue: withheld ? null : sharedValueOf(variable, scope),
			sharedHidden: withheld,
		};
	});
}

/** Names of the scope's secret variables (their local values are sealed). */
export function secretKeysOf(stored: readonly StoredVariable[]): Set<string> {
	return new Set(
		stored
			.filter((variable) => variable.type === "secret")
			.map((variable) => variable.key),
	);
}
