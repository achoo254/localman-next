import type { ClientSession, Types } from "mongoose";

/**
 * Data stored per resource by another module (mock callbacks and their
 * waiting deliveries…). Registering it here makes deleting a resource,
 * with its descendants, remove that data in the same transaction, without
 * the resources module importing those modules. A whole project going
 * away is covered by `registerProjectDependent` instead.
 */
export interface ResourceDependent {
	/** Plural noun, e.g. `callbacks`; unique among dependents. */
	readonly kind: string;
	/**
	 * Removes the data of `resourceIds` (all in `projectId`) within
	 * `session`. May run more than once (transaction retries).
	 */
	deleteFor(
		projectId: Types.ObjectId,
		resourceIds: readonly Types.ObjectId[],
		session: ClientSession,
	): Promise<void>;
}

const dependents: ResourceDependent[] = [];

/**
 * Registers a dependent at module load. Returns the unregister function
 * (tests). Throws when the kind is already registered.
 */
export function registerResourceDependent(
	dependent: ResourceDependent,
): () => void {
	if (dependents.some((existing) => existing.kind === dependent.kind)) {
		throw new Error(
			`Resource dependent "${dependent.kind}" already registered`,
		);
	}
	dependents.push(dependent);
	return () => {
		const index = dependents.indexOf(dependent);
		if (index >= 0) dependents.splice(index, 1);
	};
}

/** Removes every dependent's data of the deleted resources. */
export async function deleteResourceDependents(
	projectId: Types.ObjectId,
	resourceIds: readonly Types.ObjectId[],
	session: ClientSession,
): Promise<void> {
	if (resourceIds.length === 0) return;
	for (const dependent of dependents) {
		await dependent.deleteFor(projectId, resourceIds, session);
	}
}
