import { type ClientSession, Types } from "mongoose";
import {
	EnvironmentModel,
	type StoredEnvironment,
} from "../environments/environment-model.js";
import type { StoredVariable } from "../environments/variable-store.js";
import { LIVE_MOCK_SYNC_AUTHOR } from "./sync-keys.js";

export const BASE_URL_VARIABLE = "baseUrl";

/** What the environment of a synced collection should hold. */
export interface MockVariables {
	readonly baseUrl: string;
	/** One per resource, e.g. `userId`. */
	readonly idVariables: readonly string[];
}

/** The environment's variables of a new synced collection. */
export function initialVariables(wanted: MockVariables): StoredVariable[] {
	return [
		plainVariable(BASE_URL_VARIABLE, wanted.baseUrl),
		...wanted.idVariables.map((key) => plainVariable(key, "1")),
	];
}

function plainVariable(key: string, value: string): StoredVariable {
	return {
		id: new Types.ObjectId().toHexString(),
		key,
		type: "default",
		enabled: true,
		description: "",
		value,
		sealed: false,
	};
}

/**
 * Brings the environment in line with the mock, leaving what the user
 * owns alone: `baseUrl` follows the mock's URL (prefix and domain) only
 * while it still holds the value the last sync wrote, and an id variable
 * is added once per new resource (one the user deleted is not added
 * back). A missing environment is skipped.
 */
export async function syncEnvironment(
	environmentId: Types.ObjectId | null,
	before: MockVariables,
	wanted: MockVariables,
	session: ClientSession,
): Promise<void> {
	if (environmentId === null) return;
	const environment = await EnvironmentModel.findById(environmentId)
		.session(session)
		.lean<StoredEnvironment>();
	if (!environment) return;
	let changed = false;
	const variables = environment.variables.map((variable) => {
		const follows =
			variable.key === BASE_URL_VARIABLE &&
			!variable.sealed &&
			variable.value === before.baseUrl &&
			before.baseUrl !== wanted.baseUrl;
		if (!follows) return variable;
		changed = true;
		return { ...variable, value: wanted.baseUrl };
	});
	const present = new Set(variables.map((variable) => variable.key));
	const known = new Set(before.idVariables);
	for (const key of wanted.idVariables) {
		if (known.has(key) || present.has(key)) continue;
		variables.push(plainVariable(key, "1"));
		changed = true;
	}
	if (!changed) return;
	await EnvironmentModel.updateOne(
		{ _id: environmentId },
		{ $set: { variables, updatedBy: LIVE_MOCK_SYNC_AUTHOR } },
		{ session },
	);
}
