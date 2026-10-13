/**
 * Lists, then optionally deletes, projects of Free owners without a mock
 * request in the last N days (default 90; idle since creation when none
 * was ever recorded):
 *   pnpm --filter @localman/api cleanup:abandoned [--days 90]          # dry run
 *   pnpm --filter @localman/api cleanup:abandoned --days 90 --apply   # delete
 * `--tenant <id>` picks the tenant (default: primary, hoandat.com).
 * Reads the API environment (same validation as the server) and logs JSON
 * lines with pino; never the Mongo URI or emails. Deletion goes through
 * the regular project cascade (tombstone, dependents, document). Exit
 * code: 0 done, 1 a deletion or the run failed, 2 bad arguments or env.
 */
import { parseEnv } from "../src/config/env.js";
import { connectMongo, disconnectMongo } from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import {
	type CleanupArgs,
	parseCleanupArgs,
	runAbandonedCleanup,
} from "../src/modules/projects/abandoned-projects.js";
// Loads every module that registers project dependents (resources,
// records, collaborators…), so the cascade removes all of them.
import "../src/operations/registry.js";
import { runInTenantData } from "../src/tenancy/tenant-context.js";

const bootLogger = createLogger("info");

function exitWith(message: string, code: number): never {
	bootLogger.fatal(message);
	process.exit(code);
}

let args: CleanupArgs;
try {
	args = parseCleanupArgs(process.argv.slice(2));
} catch (error) {
	exitWith(error instanceof Error ? error.message : String(error), 2);
}

let env: ReturnType<typeof parseEnv>;
try {
	env = parseEnv(process.env);
} catch (error) {
	exitWith(error instanceof Error ? error.message : String(error), 2);
}

const logger = createLogger(env.LOG_LEVEL);
let exitCode = 0;
try {
	await connectMongo(env.MONGO_URI, logger);
	const summary = await runInTenantData(args.tenantId, () =>
		runAbandonedCleanup(args, logger),
	);
	if (summary.failed > 0) exitCode = 1;
} catch (error) {
	logger.fatal({ err: error }, "Abandoned project cleanup failed");
	exitCode = 1;
} finally {
	await disconnectMongo().catch(() => undefined);
}
process.exit(exitCode);
