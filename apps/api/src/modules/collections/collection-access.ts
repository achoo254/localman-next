import { OperationError } from "@localman/operations";
import {
	type CollectionAction,
	type ElementRole,
	elementRoleAllows,
} from "@localman/shared/access";
import type { Types } from "mongoose";
import { elementNotFound, requireElement } from "../access/access-policy.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { toObjectId } from "./collection-ids.js";

/** A live collection with the caller's role on it. */
export interface CollectionAccess {
	readonly element: ElementRecord;
	readonly collectionId: Types.ObjectId;
	readonly role: ElementRole;
}

/**
 * The live collection if `sub` may perform `action` on it: 404 when it
 * does not exist, is in the trash or the caller holds no role on it; 403
 * when their role lacks the action (a Viewer editing).
 */
export async function requireCollection(
	sub: string,
	id: string,
	action: CollectionAction,
): Promise<CollectionAccess> {
	// Any role views; the specific row of the collection table comes next.
	const { element, role } = await requireElement(sub, "collection", id, "view");
	const collectionId = toObjectId(element.id);
	if (!collectionId) throw elementNotFound();
	if (!elementRoleAllows("collection", role, action)) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return { element, collectionId, role };
}
