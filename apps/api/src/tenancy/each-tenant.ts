import type { Logger } from "../logger.js";
import { UserModel } from "../modules/users/user-model.js";
import { acrossTenants, runInTenant } from "./tenant-context.js";
import { tenantDirectory } from "./tenant-directory.js";

/**
 * Runs a periodic job once in every tenant that has users, one tenant
 * after another; a tenant's failure is logged and the next one runs.
 * Every tenant's data starts with a signed-in user, so none is missed.
 */
export async function forEachTenant(
	logger: Logger,
	job: () => Promise<unknown>,
): Promise<void> {
	const ids = await acrossTenants(() => UserModel.distinct("tenantId").exec());
	for (const id of ids) {
		if (typeof id !== "string") continue;
		const tenant = await tenantDirectory().byId(id);
		if (!tenant) {
			logger.warn({ tenantId: id }, "Skipping data of an unknown tenant");
			continue;
		}
		try {
			await runInTenant(tenant, job);
		} catch (error) {
			logger.error({ err: error, tenantId: id }, "Tenant job failed");
		}
	}
}
