import { OperationError } from "@localman/operations";
import type { JsonValue } from "@localman/shared";
import type { ClientSession } from "mongoose";
import { RecordModel } from "../resources/record-model.js";
import type { StoredResource } from "../resources/resource-model.js";
import { type MockTarget, routeParentId } from "./mock-records.js";

/** Ids of system columns: a number or a URL-safe string. */
const RECORD_REF = /^[A-Za-z0-9_.~-]{1,64}$/;

/**
 * Parent record of a new record: the one on a nested route (the body's
 * `{parent}Id` is ignored there), else the body's `{parent}Id`, which
 * must name an existing parent record (400 otherwise; a child record
 * cannot exist without a parent).
 */
export async function parentOfNew(
	target: MockTarget,
	parentRef: JsonValue | undefined,
	session: ClientSession,
): Promise<string | null> {
	const { resource, parentKey } = target;
	if (parentKey === null || resource.parentId === null) return null;
	const fromRoute = routeParentId(target);
	if (fromRoute !== null) return fromRoute;
	const ref = typeof parentRef === "number" ? String(parentRef) : parentRef;
	const exists =
		typeof ref === "string" &&
		RECORD_REF.test(ref) &&
		(await RecordModel.exists({
			resourceId: resource.parentId,
			id: ref,
		}).session(session)) !== null;
	if (!exists || typeof ref !== "string") {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`"${parentKey}" must be the id of an existing parent record`,
			[
				{
					path: parentKey,
					message: "must be the id of an existing parent record",
				},
			],
		);
	}
	return ref;
}

/** `nextId`, skipped past ids already taken (pasted string ids). */
export async function freeId(
	resource: StoredResource,
	session: ClientSession,
): Promise<number> {
	let next = resource.nextId;
	while (
		await RecordModel.exists({
			resourceId: resource._id,
			id: String(next),
		}).session(session)
	) {
		next += 1;
	}
	return next;
}
