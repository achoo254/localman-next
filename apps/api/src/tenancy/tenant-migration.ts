import {
	dropReplacedIndexes,
	tagUntaggedDocuments as tagForPrimary,
} from "@localman/tenancy";
import { initModels } from "../db/connect-mongo.js";
import type { Logger } from "../logger.js";
import { PRIMARY_TENANT_ID } from "./primary-tenant.js";

export { dropReplacedIndexes, scopedCollections } from "@localman/tenancy";

/** Tags documents stored before tenants with the primary tenant (hoandat). */
export function tagUntaggedDocuments(logger: Logger): Promise<number> {
	return tagForPrimary(logger, PRIMARY_TENANT_ID);
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
