/**
 * Importing a Run button's collection (and environment) into one of the
 * caller's workspaces: the redacted tree built here on the server, scripts
 * left out unless asked for, created through the usual services so the
 * workspace's limits and the caller's role apply. A repeat with the same
 * idempotency key within ten minutes answers the first result.
 */
import { OperationError } from "@localman/operations";
import {
	type CollectionTree,
	MAX_IMPORT_BYTES,
	type VariableInput,
	nodesToCollectionTree,
	publicCollectionTree,
} from "@localman/shared/api-client";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { createCollection } from "../collections/collection-service.js";
import { loadCollectionDetail } from "../collections/collection-store.js";
import { createEnvironment } from "../environments/environment-service.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import {
	IMPORT_KEY_TTL_MS,
	RunButtonImportModel,
	type StoredRunButtonImport,
} from "./run-button-import-model.js";
import type { RunSource } from "./run-button-source.js";
import { withoutScripts } from "./run-button-tree.js";

export interface RunImportResult {
	workspaceId: string;
	collectionId: string;
	environmentId: string | null;
	/** Why the environment was not created; the collection was. */
	environmentError: { code: string; message: string } | null;
}

export interface RunImportInput {
	readonly workspaceId: string;
	readonly includeScripts: boolean;
	readonly idempotencyKey: string;
}

/** The tree an import creates, redacted and within the import size. */
export async function importTreeOf(
	source: RunSource,
	includeScripts: boolean,
): Promise<CollectionTree> {
	const detail = await loadCollectionDetail(
		source.collection._id,
		"viewer",
		null,
	);
	const redacted = publicCollectionTree(nodesToCollectionTree(detail));
	const tree = includeScripts ? redacted : withoutScripts(redacted);
	const bytes = Buffer.byteLength(JSON.stringify(tree));
	if (bytes > MAX_IMPORT_BYTES) {
		throw new OperationError(
			413,
			"COLLECTION_TOO_LARGE",
			"This collection is too large to import",
			{ max: MAX_IMPORT_BYTES, bytes },
		);
	}
	return tree;
}

function resultOf(row: StoredRunButtonImport): RunImportResult | null {
	if (!row.collectionId) return null;
	return {
		workspaceId: row.workspaceId.toHexString(),
		collectionId: row.collectionId.toHexString(),
		environmentId: row.environmentId?.toHexString() ?? null,
		environmentError: row.environmentError ?? null,
	};
}

async function importEnvironment(
	sub: string,
	source: RunSource,
	workspaceId: string,
): Promise<Pick<RunImportResult, "environmentId" | "environmentError">> {
	if (source.environmentUnavailable) {
		const message = "The button's environment is no longer available";
		return {
			environmentId: null,
			environmentError: { code: "ENVIRONMENT_UNAVAILABLE", message },
		};
	}
	if (!source.environment)
		return { environmentId: null, environmentError: null };
	const variables = source.environment.variables.map(
		(variable): VariableInput => ({
			key: variable.key,
			type: "default",
			enabled: variable.enabled !== false,
			description: "",
			sharedValue: variable.value,
		}),
	);
	try {
		const env = await createEnvironment(sub, workspaceId, {
			name: source.environment.name,
			variables,
		});
		return { environmentId: env.id, environmentError: null };
	} catch (error) {
		if (!(error instanceof OperationError)) throw error;
		return {
			environmentId: null,
			environmentError: { code: error.code, message: error.message },
		};
	}
}

/** The result of the import that first used this key, for this button only. */
async function firstResult(
	sub: string,
	input: RunImportInput,
	buttonId: string,
): Promise<RunImportResult> {
	const first = await RunButtonImportModel.findOne({
		userId: sub,
		idempotencyKey: input.idempotencyKey,
	}).lean<StoredRunButtonImport>();
	if (
		first &&
		(first.buttonId !== buttonId ||
			first.workspaceId.toHexString() !== input.workspaceId)
	) {
		throw new OperationError(
			409,
			"IDEMPOTENCY_KEY_REUSED",
			"This idempotency key was used for another import",
		);
	}
	const done = first && resultOf(first);
	if (done) return done;
	throw new OperationError(
		409,
		"IMPORT_IN_PROGRESS",
		"This import is already running",
	);
}

export async function importFromButton(
	sub: string,
	source: RunSource,
	input: RunImportInput,
): Promise<RunImportResult> {
	const { workspace } = await requireWorkspace(
		sub,
		"addElements",
		input.workspaceId,
	);
	let claimId: unknown;
	try {
		const claim = await RunButtonImportModel.create({
			userId: sub,
			idempotencyKey: input.idempotencyKey,
			buttonId: source.button.buttonId,
			workspaceId: workspace._id,
			expiresAt: new Date(Date.now() + IMPORT_KEY_TTL_MS),
		});
		claimId = claim._id;
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		return firstResult(sub, input, source.button.buttonId);
	}
	let created: string | null = null;
	try {
		const tree = await importTreeOf(source, input.includeScripts);
		created = (await createCollection(sub, input.workspaceId, { tree })).id;
		// Recorded at once: from here a retry must not create a second one.
		await RunButtonImportModel.updateOne(
			{ _id: claimId },
			{ $set: { collectionId: created } },
		);
		const env = await importEnvironment(sub, source, input.workspaceId);
		await RunButtonImportModel.updateOne({ _id: claimId }, { $set: env });
		return { workspaceId: input.workspaceId, collectionId: created, ...env };
	} catch (error) {
		// Nothing was created: the same key may be tried again.
		if (created === null)
			await RunButtonImportModel.deleteOne({ _id: claimId });
		throw error;
	}
}
