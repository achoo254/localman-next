import type { OperationContext } from "@localman/operations";
import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { isAgentCall } from "../../http/require-auth.js";

/**
 * A local value as the caller receives it. For an agent, a secret's value
 * is withheld (`value: null, hidden: true`), as a withheld shared value is
 * (`sharedValue: null, sharedHidden: true`).
 */
export interface LocalValueOutput {
	readonly key: string;
	readonly value: string | null;
	readonly hidden?: boolean;
	readonly agentUse?: boolean;
}

/** Tells whether a variable name is a secret in the scope being read. */
export type SecretTest = (key: string) => boolean;

interface ValuesView {
	readonly variables: readonly VariableView[];
	readonly localValues: readonly LocalValue[];
}

type WithheldView<T extends ValuesView> = Omit<
	T,
	"variables" | "localValues"
> & {
	readonly variables: VariableView[];
	readonly localValues: LocalValueOutput[];
};

/** Local values with every secret one withheld. */
export function withholdLocalValues(
	values: readonly LocalValue[],
	isSecret: SecretTest,
): LocalValueOutput[] {
	return values.map((entry) =>
		isSecret(entry.key)
			? {
					key: entry.key,
					value: null,
					hidden: true,
					...(entry.agentUse ? { agentUse: true } : {}),
				}
			: entry,
	);
}

/** Shared and local values of secret variables withheld, whatever the role. */
export function withholdSecretValues<T extends ValuesView>(
	view: T,
): WithheldView<T> {
	const secrets = new Set(
		view.variables
			.filter((variable) => variable.type === "secret")
			.map((variable) => variable.key),
	);
	return {
		...view,
		variables: view.variables.map((variable) =>
			variable.type === "secret" && variable.sharedValue !== null
				? { ...variable, sharedValue: null, sharedHidden: true }
				: variable,
		),
		localValues: withholdLocalValues(view.localValues, (key) =>
			secrets.has(key),
		),
	};
}

/**
 * The view as this caller may read it: a browser session gets it as is,
 * an agent never gets a secret value back (it may still write one).
 */
export function valuesForCaller<T extends ValuesView>(
	ctx: OperationContext,
	view: T,
): T | WithheldView<T> {
	return isAgentCall(ctx) ? withholdSecretValues(view) : view;
}

/** Local values as this caller may read them; `secretsOf` runs for agents only. */
export async function localValuesForCaller(
	ctx: OperationContext,
	values: LocalValue[],
	secretsOf: () => Promise<SecretTest>,
): Promise<LocalValueOutput[]> {
	if (!isAgentCall(ctx)) return values;
	return withholdLocalValues(values, await secretsOf());
}

/**
 * A local values patch as this caller may apply it. An agent reads a
 * secret's local value as `value: null`, which is also how a reset is
 * written: for an agent such an entry is dropped, so writing back what it
 * read never erases a value (a real value still replaces it).
 */
export async function localPatchForCaller<
	T extends { readonly key: string; readonly value: string | null },
>(
	ctx: OperationContext,
	patch: T[],
	secretsOf: () => Promise<SecretTest>,
): Promise<T[]> {
	if (!isAgentCall(ctx)) return patch;
	const isSecret = await secretsOf();
	return patch.filter((entry) => entry.value !== null || !isSecret(entry.key));
}
