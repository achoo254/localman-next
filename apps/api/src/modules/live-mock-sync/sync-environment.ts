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

/** Scheme, secret and domain of a mock URL; `""` for a malformed one. */
export function mockOriginOf(url: string): string {
	try {
		return new URL(url).origin;
	} catch {
		return "";
	}
}

/** The environment's own `baseUrl` (not a secret); `null` when there is none. */
export async function environmentBaseUrl(
	environmentId: Types.ObjectId | null,
	session?: ClientSession,
): Promise<string | null> {
	if (environmentId === null) return null;
	const environment = await EnvironmentModel.findById(environmentId)
		.session(session ?? null)
		.lean<StoredEnvironment>();
	const variable = environment?.variables.find(
		(v) => v.key === BASE_URL_VARIABLE && !v.sealed,
	);
	return variable?.value ?? null;
}

/** What a sync did to the environment. */
export interface EnvironmentSync {
	/** The `baseUrl` it now stands for (the old one while the secret differs). */
	readonly baseUrl: string;
	readonly changed: boolean;
}

/**
 * Brings the environment in line with the mock, leaving what the user
 * owns alone: `baseUrl` follows the mock's prefix only while it still
 * holds the value the last sync wrote and the project secret is the same
 * (after a rotation the new secret is never written into an environment
 * the whole workspace reads, so rotating keeps cutting access; once an
 * Editor writes the new URL there, it follows again), and an id
 * variable is added once per new resource (one the user deleted is not
 * added back). A missing environment is skipped.
 */
export async function syncEnvironment(
	environmentId: Types.ObjectId | null,
	before: MockVariables,
	wanted: MockVariables,
	session: ClientSession,
): Promise<EnvironmentSync> {
	const target = mockOriginOf(wanted.baseUrl);
	if (environmentId === null)
		return { baseUrl: wanted.baseUrl, changed: false };
	const environment = await EnvironmentModel.findById(environmentId)
		.session(session)
		.lean<StoredEnvironment>();
	if (!environment) return { baseUrl: wanted.baseUrl, changed: false };
	const held = environment.variables.find(
		(v) => v.key === BASE_URL_VARIABLE && !v.sealed,
	)?.value;
	// After a rotation, once an Editor put the new mock URL there by hand,
	// it is what the sync follows from then on.
	const caughtUp =
		mockOriginOf(before.baseUrl) !== target &&
		held !== undefined &&
		held !== null &&
		mockOriginOf(held) === target;
	const from = caughtUp && held ? held : before.baseUrl;
	const sameSecret = mockOriginOf(from) === target;
	const baseUrl = sameSecret ? wanted.baseUrl : from;
	let changed = false;
	const variables = environment.variables.map((variable) => {
		const follows =
			variable.key === BASE_URL_VARIABLE &&
			!variable.sealed &&
			variable.value === from &&
			from !== baseUrl;
		if (!follows) return variable;
		changed = true;
		return { ...variable, value: baseUrl };
	});
	const present = new Set(variables.map((variable) => variable.key));
	const known = new Set(before.idVariables);
	for (const key of wanted.idVariables) {
		if (known.has(key) || present.has(key)) continue;
		variables.push(plainVariable(key, "1"));
		changed = true;
	}
	if (!changed) return { baseUrl, changed: false };
	await EnvironmentModel.updateOne(
		{ _id: environmentId },
		{ $set: { variables, updatedBy: LIVE_MOCK_SYNC_AUTHOR } },
		{ session },
	);
	return { baseUrl, changed: true };
}
