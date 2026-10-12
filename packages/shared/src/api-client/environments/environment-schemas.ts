/**
 * zod schemas of the environments and globals API inputs, apart from the
 * plain types so a client that only needs the types does not pull zod.
 */
import { z } from "zod";
import {
	ENVIRONMENT_COLORS,
	ENVIRONMENT_NAME_MAX,
	ENVIRONMENT_VARIABLES_MAX,
	LOCAL_VALUES_MAX,
	VARIABLE_DESCRIPTION_MAX,
	VARIABLE_KEY_MAX,
	VARIABLE_TYPES,
	VARIABLE_VALUE_MAX,
} from "./environment-model.js";

export const environmentNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(ENVIRONMENT_NAME_MAX);
export const environmentColorSchema = z.enum(ENVIRONMENT_COLORS);
const variableKey = z.string().trim().min(1).max(VARIABLE_KEY_MAX);
const variableValue = z.string().max(VARIABLE_VALUE_MAX);

/**
 * A variable as an Editor writes it. `id` keeps an existing variable (a
 * new one gets an id); `sharedValue: null` leaves the value unshared.
 */
export const variableInputSchema = z.object({
	id: z.string().min(1).max(64).optional(),
	key: variableKey,
	type: z.enum(VARIABLE_TYPES).default("default"),
	enabled: z.boolean().default(true),
	description: z.string().max(VARIABLE_DESCRIPTION_MAX).default(""),
	sharedValue: variableValue.nullable().default(null),
});
export type VariableInput = z.infer<typeof variableInputSchema>;

/** Every variable of a scope, in order; names are unique (case kept). */
export const variableListSchema = z
	.array(variableInputSchema)
	.max(ENVIRONMENT_VARIABLES_MAX)
	.superRefine((variables, ctx) => {
		const seen = new Set<string>();
		variables.forEach((variable, index) => {
			if (seen.has(variable.key)) {
				ctx.addIssue({
					code: "custom",
					path: [index, "key"],
					message: `Duplicate variable name "${variable.key}"`,
				});
			}
			seen.add(variable.key);
		});
	});

/**
 * Local values to set, by name; `value: null` removes one (the variable
 * goes back to its shared value). Names not listed keep their value.
 */
export const localValuesPatchSchema = z
	.array(z.object({ key: variableKey, value: variableValue.nullable() }))
	.max(LOCAL_VALUES_MAX);
export type LocalValuesPatch = z.infer<typeof localValuesPatchSchema>;
