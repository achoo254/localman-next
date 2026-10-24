/**
 * Before switching to a new release (and safe to repeat): builds every
 * index of the registered models (tenant-prefixed), so the new release
 * starts within the 30 seconds `switch-release.sh` waits. Existing
 * indexes are left as they are.
 *   pnpm --filter @localman/api create-tenant-indexes
 * Reads the API environment; logs JSON lines, never the Mongo URI.
 */
import { parseEnv } from "../src/config/env.js";
import {
	connectMongo,
	disconnectMongo,
	initModels,
} from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import "../src/db/register-models.js";

const logger = createLogger("info");
let exitCode = 0;
try {
	const env = parseEnv(process.env);
	await connectMongo(env.MONGO_URI, logger);
	await initModels();
	logger.info("Tenant indexes built");
} catch (error) {
	logger.fatal({ err: error }, "Building tenant indexes failed");
	exitCode = 1;
} finally {
	await disconnectMongo().catch(() => undefined);
}
process.exit(exitCode);
