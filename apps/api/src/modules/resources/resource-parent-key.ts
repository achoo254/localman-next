import { OperationError } from "@localman/operations";
import {
	parentKeyIssue,
	parentKeyOf,
	resourceParentKey,
} from "@localman/shared";
import type { AnyBulkWriteOperation, ClientSession, Types } from "mongoose";
import { RecordModel } from "./record-model.js";
import type { StoredResource } from "./resource-model.js";
import {
	type ResourceDefinition,
	assertDefinitionFits,
	childIdsOf,
} from "./resource-rules.js";
import { parentKeyIn } from "./resource-store.js";

function parentKeyError(message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", message, [
		{ path: "parentKey", message },
	]);
}

/**
 * The Parent ID a create or update stores. `current` is the key the
 * resource has, or would get, without `sent`; `null` for a root, which
 * takes no key (sending one is a 400). A sent key equal to `current` is
 * kept as is, even one an older rule built; another must pass
 * `parentKeyIssue` and must not name a field or template key of the
 * resource. Errors are 400 `VALIDATION_ERROR` at `parentKey`.
 */
export function chooseParentKey(
	sent: string | undefined,
	current: string | null,
	definition: ResourceDefinition,
): string | null {
	if (sent === undefined || sent === current) return current;
	if (current === null) {
		throw parentKeyError("Only a nested resource has a Parent ID field");
	}
	const issue = parentKeyIssue(sent);
	if (issue) throw parentKeyError(issue);
	const taken =
		definition.schema.some((field) => field.name === sent) ||
		Object.hasOwn(definition.template ?? {}, sent);
	if (taken) {
		throw parentKeyError(`"${sent}" is already a field of this resource`);
	}
	return sent;
}

/**
 * Refuses (409) a new Parent ID that records of `resourceIds` already hold
 * as a data field: the generated value would hide theirs. The key is read
 * with `$getField` on a literal, so a `$` in it never becomes an operator.
 */
export async function assertRecordsFree(
	resourceIds: readonly Types.ObjectId[],
	key: string,
	session: ClientSession,
): Promise<void> {
	if (resourceIds.length === 0) return;
	const clash = await RecordModel.exists({
		resourceId: { $in: resourceIds },
		$expr: {
			$ne: [
				{ $type: { $getField: { field: { $literal: key }, input: "$data" } } },
				"missing",
			],
		},
	}).session(session);
	if (clash) {
		throw new OperationError(
			409,
			"FIELD_CONFLICT",
			`Records already have a field "${key}"; rename or remove it first`,
		);
	}
}

/**
 * A child's Parent ID once its parent is renamed from `from` to `to`: a
 * key built from the old name follows the new one (as before keys were
 * stored), a key the user chose stays, and a resource without a stored
 * key keeps following the old rule.
 */
function keyAfterRename(
	child: StoredResource,
	from: string,
	to: string,
): string {
	if (typeof child.parentKey !== "string") return resourceParentKey(child, to);
	return child.parentKey === parentKeyOf(from)
		? parentKeyOf(to)
		: child.parentKey;
}

/**
 * Checks the children of `parent` against the Parent ID they get once it
 * is named `name` (409 when a schema or records would clash) and returns
 * the writes that store the changed keys.
 */
export async function renameChildKeys(
	resources: readonly StoredResource[],
	parent: StoredResource,
	name: string,
	session: ClientSession,
): Promise<AnyBulkWriteOperation[]> {
	const writes: AnyBulkWriteOperation[] = [];
	for (const child of resources.filter((r) => r.parentId?.equals(parent._id))) {
		const before = parentKeyIn(resources, child);
		const after = keyAfterRename(child, parent.name, name);
		assertDefinitionFits(
			child,
			{ parentKey: after, childIds: childIdsOf(resources, child) },
			false,
		);
		if (after === before) continue;
		await assertRecordsFree([child._id], after, session);
		if (typeof child.parentKey === "string") {
			writes.push({
				updateOne: {
					filter: { _id: child._id },
					update: { $set: { parentKey: after } },
				},
			});
		}
	}
	return writes;
}
