import type { Logger } from "./logger.js";
import { configureShareLogger } from "./modules/access/share-service.js";
import { configureAccountDeletionLogger } from "./modules/account-deletion/account-deletion-log.js";
import { configureProxyLogger } from "./modules/api-client/proxy-operations.js";

/**
 * Hands the app logger to the modules that log outside a request's own
 * logger (proxy, sharing, account deletion); each stays silent
 * until then.
 */
export function configureModuleLoggers(logger: Logger): void {
	configureProxyLogger(logger);
	configureShareLogger(logger);
	configureAccountDeletionLogger(logger);
}
