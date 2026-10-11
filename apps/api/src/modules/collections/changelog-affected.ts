import type { AffectedNode } from "@localman/shared/api-client";
import type { Operation } from "fast-json-patch";
import { Types } from "mongoose";
import { CollectionNodeModel } from "./collection-node-model.js";
import { entityOfPath } from "./revision-patch.js";

function nameIn(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;
	const name: unknown = Reflect.get(value, "name");
	return typeof name === "string" ? name : null;
}

/**
 * The nodes a change rewrote and how, from its forward patch: a whole
 * node added or removed, or fields of it changed. Names come from the
 * patches, else from the node as it is now (one bounded query).
 */
export async function affectedNodes(
	collectionId: Types.ObjectId,
	forward: readonly Operation[],
	inverse: readonly Operation[],
): Promise<AffectedNode[]> {
	const byId = new Map<string, AffectedNode>();
	const removedNames = new Map<string, string | null>();
	for (const op of inverse) {
		const id = entityOfPath(op.path);
		if (op.op === "add" && op.path === `/nodes/${id}`)
			removedNames.set(id, nameIn(op.value));
	}
	for (const op of forward) {
		const id = entityOfPath(op.path);
		if (
			id === "root" ||
			id === "" ||
			(byId.has(id) && op.path !== `/nodes/${id}`)
		)
			continue;
		const whole = op.path === `/nodes/${id}`;
		if (whole && op.op === "add")
			byId.set(id, { nodeId: id, name: nameIn(op.value), change: "added" });
		else if (whole && op.op === "remove") {
			byId.set(id, {
				nodeId: id,
				name: removedNames.get(id) ?? null,
				change: "removed",
			});
		} else if (!byId.has(id))
			byId.set(id, { nodeId: id, name: null, change: "changed" });
	}
	const unnamed = [...byId.values()].filter((node) => node.name === null);
	const ids = unnamed.flatMap((node) =>
		Types.ObjectId.isValid(node.nodeId)
			? [new Types.ObjectId(node.nodeId)]
			: [],
	);
	if (ids.length > 0) {
		const rows = await CollectionNodeModel.find(
			{ collectionId, _id: { $in: ids } },
			{ name: 1 },
		).lean<{ _id: Types.ObjectId; name: string }[]>();
		for (const row of rows) {
			const node = byId.get(row._id.toHexString());
			if (node) node.name = row.name;
		}
	}
	return [...byId.values()];
}
