import { ELEMENT_ROLES, type ElementRole } from "@localman/shared/access";
import {
	ENVIRONMENT_COLORS,
	type EnvironmentDetail,
	type EnvironmentSummary,
	VARIABLE_TYPES,
} from "@localman/shared/api-client";
import { z } from "zod";
import { displayNames } from "../users/display-names.js";
import {
	type StoredEnvironment,
	environmentScope,
} from "./environment-model.js";
import { readLocalValues } from "./local-values.js";
import { toVariableViews } from "./variable-store.js";

export const variableView = z.object({
	id: z.string(),
	key: z.string(),
	type: z.enum(VARIABLE_TYPES),
	enabled: z.boolean(),
	description: z.string(),
	sharedValue: z.string().nullable(),
	sharedHidden: z.boolean(),
});

/** `value: null, hidden: true` is a secret's value withheld from an agent. */
export const localValueView = z.object({
	key: z.string(),
	value: z.string().nullable(),
	hidden: z.boolean().optional(),
	agentUse: z.boolean().optional(),
});

export const environmentSummaryView = z.object({
	id: z.string(),
	workspaceId: z.string(),
	name: z.string(),
	color: z.enum(ENVIRONMENT_COLORS),
	role: z.enum(ELEMENT_ROLES),
	variableCount: z.number().int(),
	updatedAt: z.string(),
});

export const environmentDetailView = environmentSummaryView.extend({
	variables: z.array(variableView),
	localValues: z.array(localValueView),
	createdBy: z.string(),
	createdByName: z.string().nullable(),
	createdAt: z.string(),
});

/** What a list reads of an environment (`LISTED_PROJECTION`). */
export type ListedEnvironment = Pick<
	StoredEnvironment,
	"_id" | "workspaceId" | "name" | "color" | "updatedAt"
> & { readonly variableCount: number };

/** Counts variables in Mongo, so a list never loads their values. */
export const LISTED_PROJECTION = {
	workspaceId: 1,
	name: 1,
	color: 1,
	updatedAt: 1,
	variableCount: { $size: "$variables" },
} as const;

export function toEnvironmentSummary(
	listed: ListedEnvironment,
	role: ElementRole,
): EnvironmentSummary {
	return {
		id: listed._id.toHexString(),
		workspaceId: listed.workspaceId.toHexString(),
		name: listed.name,
		color: listed.color,
		role,
		variableCount: listed.variableCount,
		updatedAt: listed.updatedAt.toISOString(),
	};
}

/**
 * The environment as `sub` sees it: shared values (secrets withheld from
 * a Viewer), `sub`'s own local values and the creator's display name.
 */
export async function toEnvironmentDetail(
	sub: string,
	stored: StoredEnvironment,
	role: ElementRole,
): Promise<EnvironmentDetail> {
	const scope = environmentScope(stored._id);
	const [localValues, names] = await Promise.all([
		readLocalValues(sub, scope),
		displayNames([stored.createdBy]),
	]);
	return {
		...toEnvironmentSummary(
			{ ...stored, variableCount: stored.variables.length },
			role,
		),
		variables: toVariableViews(stored.variables, scope, role === "editor"),
		localValues,
		createdBy: stored.createdBy,
		createdByName: names.get(stored.createdBy) ?? null,
		createdAt: stored.createdAt.toISOString(),
	};
}
