import { toObjectId } from "../collections/collection-ids.js";
import {
	CollectionModel,
	type StoredCollection,
} from "../collections/collection-model.js";
import type { SecretTest } from "./agent-secret-mask.js";
import {
	EnvironmentModel,
	type StoredEnvironment,
} from "./environment-model.js";
import {
	GlobalVariablesModel,
	type StoredGlobals,
} from "./global-variables-model.js";
import { type StoredVariable, secretKeysOf } from "./variable-store.js";

/*
 * Which names are secrets in a scope the caller was just allowed into, to
 * withhold an agent's local values. A scope that cannot be read (bad id,
 * deleted meanwhile) treats every name as secret, so nothing leaks.
 */
const everySecret: SecretTest = () => true;

function testOf(secrets: ReadonlySet<string>): SecretTest {
	return (key) => secrets.has(key);
}

function storedSecrets(
	variables: readonly StoredVariable[] | undefined,
): SecretTest {
	return variables ? testOf(secretKeysOf(variables)) : everySecret;
}

export async function environmentSecrets(
	environmentId: string,
): Promise<SecretTest> {
	const id = toObjectId(environmentId);
	if (!id) return everySecret;
	const stored = await EnvironmentModel.findById(id, { variables: 1 }).lean<
		Pick<StoredEnvironment, "variables">
	>();
	return storedSecrets(stored?.variables);
}

/** Globals not saved yet have no variables, hence no secrets. */
export async function globalsSecrets(workspaceId: string): Promise<SecretTest> {
	const id = toObjectId(workspaceId);
	if (!id) return everySecret;
	const stored = await GlobalVariablesModel.findOne(
		{ workspaceId: id },
		{ variables: 1 },
	).lean<Pick<StoredGlobals, "variables">>();
	return storedSecrets(stored?.variables ?? []);
}

/** Collection variables flagged `secret` (stored unencrypted). */
export async function collectionSecrets(
	collectionId: string,
): Promise<SecretTest> {
	const id = toObjectId(collectionId);
	if (!id) return everySecret;
	const stored = await CollectionModel.findById(id, { variables: 1 }).lean<
		Pick<StoredCollection, "variables">
	>();
	if (!stored) return everySecret;
	return testOf(
		new Set(
			stored.variables
				.filter((variable) => variable.secret === true)
				.map((variable) => variable.key),
		),
	);
}
