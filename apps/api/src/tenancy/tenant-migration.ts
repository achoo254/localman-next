import mongoose, { type Collection } from "mongoose";
import { initModels } from "../db/connect-mongo.js";
import type { Logger } from "../logger.js";
import { PRIMARY_TENANT_ID } from "./primary-tenant.js";
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
 * Tags documents stored before tenants with the primary tenant (hoandat
 * was the only one). Cheap once done: `{ tenantId: null }` is answered
 * by every index's `tenantId` prefix. Returns the documents tagged.
 */
export async function tagUntaggedDocuments(logger: Logger): Promise<number> {
	let tagged = 0;
	for (const [name, collection] of scopedCollections()) {
		const result = await collection.updateMany(
			{ tenantId: null },
			{ $set: { tenantId: PRIMARY_TENANT_ID } },
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
export async function dropReplacedIndexes(logger: Logger): Promise<string[]> {
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

/**
 * Startup, before listening: old documents get the primary tenant and
 * every index (tenant-prefixed) is built; `create-tenant-indexes` does
 * both before a deploy, so this only catches documents written in
 * between. The indexes they replace are dropped once other tenants are
 * served (`multiTenant`): until then they stay, so rolling back to a
 * release before tenants needs no index build, and once a second tenant
 * writes, the old unique indexes would refuse its documents.
 */
export async function migrateToTenants(
	logger: Logger,
	multiTenant: boolean,
): Promise<void> {
	await tagUntaggedDocuments(logger);
	await initModels();
	if (multiTenant) await dropReplacedIndexes(logger);
}
