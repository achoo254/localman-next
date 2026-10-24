/**
 * The caller's local values of environments and globals; the collection's
 * are in `variable-scopes-api.ts`. A secret's value goes through the vault.
 */
import type { LocalValue } from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectRecord } from "../../lib/json-guards";
import {
	type LocalTarget,
	environmentScope,
	globalsScope,
	sealLocalWrites,
} from "../secure-vault/vault-codec";
import { parseLocalValues } from "./environment-parsers";
import { environmentPath, workspacePath } from "./environments-api";
import {
	inLocalQueue,
	latestAnswer,
	rememberAnswer,
} from "./local-write-queue";

/**
 * `value: null` resets a variable to its shared value; `agentValue` is
 * the plaintext copy of a vault value agents may use (ADR-0009).
 */
export type LocalValueWrite = {
	key: string;
	value: string | null;
	agentValue?: string | null;
};

const NO_SECRETS: ReadonlySet<string> = new Set();

async function sendLocal(
	target: LocalTarget,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	const sealed = await sealLocalWrites(target, values);
	const data = expectRecord(
		await apiRequest(target.path, {
			method: "PATCH",
			body: { values: sealed },
		}),
		"local values",
	);
	const saved = parseLocalValues(data.localValues);
	rememberAnswer(target.path, saved);
	return saved;
}

/**
 * Saves local values, after the scope's earlier writes; a secret's value
 * (`target.secretKeys`) is encrypted by the vault first
 * (`sealLocalWrites`, which may ask to unlock it).
 */
export function patchLocal(
	target: LocalTarget,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	return inLocalQueue(target.path, () => sendLocal(target, values));
}

/**
 * Writes worked out at their turn in the scope's queue, from the last
 * answer of the writes before (`undefined`: none running, read the
 * cache). `null` when `build` finds nothing to write.
 */
export function patchLocalWhenDue(
	target: LocalTarget,
	build: (latest: LocalValue[] | undefined) => LocalValueWrite[],
): Promise<LocalValue[] | null> {
	return inLocalQueue(target.path, async () => {
		const writes = build(latestAnswer(target.path));
		return writes.length > 0 ? sendLocal(target, writes) : null;
	});
}

export const environmentLocalTarget = (
	id: string,
	secretKeys: ReadonlySet<string> = NO_SECRETS,
): LocalTarget => ({
	path: `${environmentPath(id)}/local-values`,
	scope: environmentScope(id),
	secretKeys,
});

export const globalsLocalTarget = (
	workspaceId: string,
	secretKeys: ReadonlySet<string> = NO_SECRETS,
): LocalTarget => ({
	path: workspacePath(workspaceId, "globals/local-values"),
	scope: globalsScope(workspaceId),
	secretKeys,
});

/** `secretKeys`: the environment's secret names (their values are sealed). */
export function setEnvironmentLocalValues(
	id: string,
	values: LocalValueWrite[],
	secretKeys: ReadonlySet<string> = NO_SECRETS,
): Promise<LocalValue[]> {
	return patchLocal(environmentLocalTarget(id, secretKeys), values);
}

export function setGlobalsLocalValues(
	workspaceId: string,
	values: LocalValueWrite[],
	secretKeys: ReadonlySet<string> = NO_SECRETS,
): Promise<LocalValue[]> {
	return patchLocal(globalsLocalTarget(workspaceId, secretKeys), values);
}
