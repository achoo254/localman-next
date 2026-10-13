/**
 * Before deploying the release that adds tenants (and safe to repeat):
 * tags documents stored before tenants with the primary tenant and builds
 * every tenant-prefixed index, so the new release starts within the 30
 * seconds `switch-release.sh` waits. The old indexes stay until the new
 * release drops them at startup (the running release still uses them).
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
import { tagUntaggedDocuments } from "../src/tenancy/tenant-migration.js";
import "../src/db/register-models.js";

const logger = createLogger("info");
let exitCode = 0;
try {
	const env = parseEnv(process.env);
	await connectMongo(env.MONGO_URI, logger);
	const tagged = await tagUntaggedDocuments(logger);
	await initModels();
	logger.info({ tagged }, "Tenant indexes built");
} catch (error) {
	logger.fatal({ err: error }, "Building tenant indexes failed");
	exitCode = 1;
} finally {
	await disconnectMongo().catch(() => undefined);
}
process.exit(exitCode);
