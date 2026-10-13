import mongoose, { type Collection } from "mongoose";
import type { TenancyLogger } from "./tenancy-logger.js";
import { TENANT_SCOPED } from "./tenant-scope-plugin.js";

/**
 * Collections of the registered models the tenant scope plugin was
 * applied to, by name (two models may share one, e.g. `feedback`).
 */
export function scopedCollections(): Map<string, Collection> {
	const byName = new Map<string, Collection>();
	for (const name of mongoose.modelNames()) {
		const model = mongoose.model(name);
		if (Reflect.get(model.schema, TENANT_SCOPED) !== true) continue;
		byName.set(model.collection.collectionName, model.collection);
	}
	return byName;
}

/**
 * Tags documents stored before tenants with the primary tenant (the only
 * one then). Cheap once done: `{ tenantId: null }` is answered
 * by every index's `tenantId` prefix. Returns the documents tagged.
 */
export async function tagUntaggedDocuments(
	logger: TenancyLogger,
	primaryTenantId: string,
): Promise<number> {
	let tagged = 0;
	for (const [name, collection] of scopedCollections()) {
		const result = await collection.updateMany(
			{ tenantId: null },
			{ $set: { tenantId: primaryTenantId } },
		);
		if (result.modifiedCount > 0) {
			logger.info(
				{ collection: name, documents: result.modifiedCount },
				"Tagged documents stored before tenants",
			);
		}
		tagged += result.modifiedCount;
	}
	return tagged;
}

const keyOf = (key: object): string => JSON.stringify(key);

/**
 * Drops the indexes replaced by their `tenantId`-prefixed version (the
 * same keys after `tenantId`), once that version exists. Any other index
 * (an ops one, `_id`, TTL) is left alone. Returns the names dropped.
 */
export async function dropReplacedIndexes(
	logger: TenancyLogger,
): Promise<string[]> {
	const dropped: string[] = [];
	for (const [name, collection] of scopedCollections()) {
		const existing = await collection.indexes();
		const present = new Set(existing.map((index) => keyOf(index.key)));
		for (const index of existing) {
			if (!index.name || "tenantId" in index.key) continue;
			const prefixed = keyOf({ tenantId: 1, ...index.key });
			if (!present.has(prefixed)) continue;
			await collection.dropIndex(index.name);
			logger.info(
				{ collection: name, index: index.name },
				"Dropped an index replaced by its tenant version",
			);
			dropped.push(index.name);
		}
	}
	return dropped;
}
