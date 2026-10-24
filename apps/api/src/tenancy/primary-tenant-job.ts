import type { Logger } from "../logger.js";
import { runInTenant } from "./tenant-context.js";
import { tenantDirectory } from "./tenant-directory.js";

/**
 * Runs a periodic job in the primary tenant, the only one served. A
 * failure is logged, never thrown, so the timer keeps running.
 */
export async function runInPrimaryTenant(
	logger: Logger,
	job: () => Promise<unknown>,
): Promise<void> {
	try {
		await runInTenant(tenantDirectory().primary, job);
	} catch (error) {
		logger.error({ err: error }, "Tenant job failed");
	}
}
