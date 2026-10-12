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

/**
 * The variables an Editor sent, ready to store in `scope`: listed ids are
 * kept when they exist, others get a new one; secret values are sealed.
 */
export function toStoredVariables(
	inputs: readonly VariableInput[],
	previous: readonly StoredVariable[],
	scope: string,
): StoredVariable[] {
	const known = new Set(previous.map((variable) => variable.id));
	return inputs.map((input): StoredVariable => {
		const id =
			input.id && known.has(input.id)
				? input.id
				: new Types.ObjectId().toHexString();
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
			variable.type === "secret" && variable.value !== null && !revealSecrets;
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
