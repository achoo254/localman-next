import { OperationError } from "@localman/operations";
import type {
	ActiveEnvironment,
	LocalValue,
	LocalValuesPatch,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { requireCollection } from "../collections/collection-access.js";
import { toObjectId } from "../collections/collection-ids.js";
import {
	CollectionModel,
	type StoredCollection,
} from "../collections/collection-model.js";
import { ActiveEnvironmentModel } from "./active-environment-model.js";
import { requireEnvironment } from "./environment-access.js";
import {
	EnvironmentModel,
	type StoredEnvironment,
	environmentScope,
} from "./environment-model.js";
import { patchLocalValues, readLocalValues } from "./local-values.js";
import { BROWSER_WRITER, type LocalWriter } from "./local-vault-rules.js";
import { secretKeysOf } from "./variable-store.js";

/** Anyone who uses the environment sets their own local values in it. */
export async function patchEnvironmentLocalValues(
	sub: string,
	id: string,
	patch: LocalValuesPatch,
	writer: LocalWriter = BROWSER_WRITER,
): Promise<LocalValue[]> {
	const { environmentId } = await requireEnvironment(
		sub,
		id,
		"editLocalValues",
	);
	return patchLocalValues(
		sub,
		environmentScope(environmentId),
		patch,
		async () => {
			const stored = await EnvironmentModel.findById(environmentId, {
				variables: 1,
			}).lean<Pick<StoredEnvironment, "variables">>();
			return {
				exists: stored !== null,
				secretKeys: secretKeysOf(stored?.variables ?? []),
			};
		},
		writer,
	);
}

/** Scope name of a collection's variables in local values. */
export const collectionScope = (id: Types.ObjectId): string =>
	`collection:${id.toHexString()}`;

/**
 * The caller's local values of a collection's variables. Collection
 * variables are not encrypted by the server (their secret flag only masks
 * the UI), so neither are these; with the vault on, a flagged one's local
 * value is a browser ciphertext like any secret's.
 */
export async function getCollectionLocalValues(
	sub: string,
	id: string,
): Promise<LocalValue[]> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return readLocalValues(sub, collectionScope(collectionId));
}

export async function patchCollectionLocalValues(
	sub: string,
	id: string,
	patch: LocalValuesPatch,
	writer: LocalWriter = BROWSER_WRITER,
): Promise<LocalValue[]> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return patchLocalValues(
		sub,
		collectionScope(collectionId),
		patch,
		async () => {
			const stored = await CollectionModel.findById(collectionId, {
				variables: 1,
			}).lean<Pick<StoredCollection, "variables">>();
			return {
				exists: stored !== null,
				secretKeys: new Set<string>(),
				vaultKeys: new Set(
					(stored?.variables ?? [])
						.filter((variable) => variable.secret === true)
						.map((variable) => variable.key),
				),
			};
		},
		writer,
	);
}

/**
 * The caller's active environment in the workspace; none when it was
 * deleted, moved elsewhere, or they lost access to it.
 */
export async function getActiveEnvironment(
	sub: string,
	workspaceId: string,
): Promise<ActiveEnvironment> {
	const none = { workspaceId, environmentId: null };
	const wsId = toObjectId(workspaceId);
	if (!wsId) return none;
	const row = await ActiveEnvironmentModel.findOne(
		{ userId: sub, workspaceId: wsId },
		{ environmentId: 1 },
	).lean<{ environmentId: Types.ObjectId }>();
	if (!row) return none;
	try {
		const { element } = await requireEnvironment(
			sub,
			row.environmentId.toHexString(),
			"use",
		);
		if (!element.workspaceId.equals(wsId)) return none;
	} catch (error) {
		// Deleted, or no longer theirs to use (404/403): no active environment.
		if (error instanceof OperationError) return none;
		throw error;
	}
	return { workspaceId, environmentId: row.environmentId.toHexString() };
}

/** Picks the environment to use in its workspace, or none (`null`). */
export async function setActiveEnvironment(
	sub: string,
	workspaceId: string,
	environmentId: string | null,
): Promise<ActiveEnvironment> {
	const wsId = toObjectId(workspaceId);
	if (!wsId) throw new OperationError(404, "NOT_FOUND", "Workspace not found");
	if (environmentId === null) {
		await ActiveEnvironmentModel.deleteOne({ userId: sub, workspaceId: wsId });
		return { workspaceId, environmentId: null };
	}
	const { element, environmentId: envId } = await requireEnvironment(
		sub,
		environmentId,
		"use",
	);
	if (!element.workspaceId.equals(wsId)) {
		throw new OperationError(
			409,
			"ENVIRONMENT_NOT_IN_WORKSPACE",
			"The environment belongs to another workspace",
		);
	}
	await ActiveEnvironmentModel.updateOne(
		{ userId: sub, workspaceId: wsId },
		{ $set: { environmentId: envId } },
		{ upsert: true },
	);
	return { workspaceId, environmentId: envId.toHexString() };
}
