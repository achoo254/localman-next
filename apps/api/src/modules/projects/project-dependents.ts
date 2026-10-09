import type { Types } from "mongoose";

/**
 * Data stored under a project by another module (resources, records,
 * collaborators…). Registering it here makes project deletion cascade to it
 * and lets a clone copy it, without the projects module importing those
 * modules.
 */
export interface ProjectDependent {
	/** Plural noun shown in a delete preview, e.g. `resources`. */
	readonly kind: string;
	count(projectId: Types.ObjectId): Promise<number>;
	/** Removes everything of the project; must be safe to run twice. */
	deleteAll(projectId: Types.ObjectId): Promise<void>;
	/**
	 * Copies the data of `from` into the freshly created clone `to`.
	 * Absent for data a clone must not inherit, such as members.
	 */
	copy?(from: Types.ObjectId, to: Types.ObjectId): Promise<void>;
}

const dependents: ProjectDependent[] = [];

/**
 * Registers a dependent at module load. Returns the unregister function
 * (tests). Throws when the kind is already registered.
 */
export function registerProjectDependent(
	dependent: ProjectDependent,
): () => void {
	if (dependents.some((existing) => existing.kind === dependent.kind)) {
		throw new Error(`Project dependent "${dependent.kind}" already registered`);
	}
	dependents.push(dependent);
	return () => {
		const index = dependents.indexOf(dependent);
		if (index >= 0) dependents.splice(index, 1);
	};
}

/** Dependents in registration order. */
export function projectDependents(): readonly ProjectDependent[] {
	return [...dependents];
}
