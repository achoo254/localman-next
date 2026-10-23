import type { Types } from "mongoose";
import {
	type LocalmanTenant,
	findCurrentTenant,
} from "../../tenancy/tenant-context.js";

/**
 * `resource.changed`: what the mock serves of a project changed (a
 * resource added, renamed, moved, deleted, its schema or endpoints, or the
 * project's prefix). Records are not part of it. Sent once per committed
 * write, in the writer's tenant; listeners run after the write and their
 * errors never reach it. Writes without a tenant's settings (ops commands
 * on one tenant's data) send nothing.
 */
export interface ResourceChanged {
	readonly tenant: LocalmanTenant;
	readonly projectId: string;
}

type Listener = (event: ResourceChanged) => void;

const listeners = new Set<Listener>();

/** Returns the unsubscribe function. */
export function onResourceChanged(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function emitResourceChanged(projectId: Types.ObjectId | string): void {
	const tenant = findCurrentTenant();
	if (!tenant) return;
	const event = {
		tenant,
		projectId:
			typeof projectId === "string" ? projectId : projectId.toHexString(),
	};
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// A listener's failure is its own; the write already happened.
		}
	}
}
