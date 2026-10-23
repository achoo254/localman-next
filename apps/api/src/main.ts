import type { Server } from "node:http";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import type { Express } from "express";
import { createBackgroundJobs } from "./background-jobs.js";
import { type Env, parseEnv } from "./config/env.js";
import {
	configureRuntime,
	runtimeSettingsFromEnv,
} from "./config/runtime-settings.js";
import { createDashboardApp } from "./dashboard-server.js";
import { connectMongo, disconnectMongo } from "./db/connect-mongo.js";
import { closeServer } from "./http/close-server.js";
import { runShutdownSteps, shutdownSteps } from "./lib/shutdown-sequence.js";
import { type Logger, createLogger } from "./logger.js";
import { createMockApp } from "./mock-server.js";
import { configureModuleLoggers } from "./module-loggers.js";
import {
	authSettingsFromEnv,
	createAuthModule,
} from "./modules/auth/auth-module.js";
import { createLocalmanMcpRouter } from "./modules/mcp/localman-mcp-server.js";
import { McpHandlerRegistry } from "./modules/mcp/mcp-handler-registry.js";
import { outboundQueue } from "./modules/mock-callbacks/retry-queue.js";
import { closeLogStreams } from "./modules/mock-runtime/log-stream-routes.js";
import { notifyQuotaWarning } from "./modules/mock-runtime/quota-warnings.js";
import { requestLog } from "./modules/mock-runtime/request-log-service.js";
import { UsageMeter } from "./modules/mock-runtime/usage-meter.js";
import {
	getNotificationService,
	setNotificationService,
} from "./modules/notifications/notification-runtime.js";
import {
	type NotificationService,
	createNotificationService,
} from "./modules/notifications/notification-service.js";
import { configureTunelo } from "./modules/tunelo/tunelo-runtime.js";
import { servedOperations } from "./operations/feature-gates.js";
import { operations as registeredOperations } from "./operations/registry.js";
import { configureTenancy } from "./tenancy/configure-tenancy.js";
import { migrateToTenants } from "./tenancy/tenant-migration.js";

/** Budget of the whole shutdown (`runShutdownSteps` cuts it there). */
const SHUTDOWN_TIMEOUT_MS = 10_000;
/**
 * Per-address connect budget of Node's happy eyeballs (default 250 ms).
 * From the production host IPv6 to api.telegram.org is dead and IPv4 needs
 * about 290 ms to connect, so the default aborted most Telegram sends with
 * ETIMEDOUT.
 */
const CONNECT_ATTEMPT_TIMEOUT_MS = 1_000;

setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);

function loadEnvOrExit(): Env {
	try {
		return parseEnv(process.env);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		createLogger("info").fatal(message);
		process.exit(1);
	}
}

/** `host` undefined: every interface (Node's default). */
function listen(
	app: Express,
	port: number,
	host: string | undefined,
): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server =
			host === undefined ? app.listen(port) : app.listen(port, host);
		server.once("error", reject);
		server.once("listening", () => {
			server.off("error", reject);
			resolve(server);
		});
	});
}

const env = loadEnvOrExit();
const logger: Logger = createLogger(env.LOG_LEVEL);
configureModuleLoggers(logger);
requestLog.configure(logger);
const servers: Server[] = [];
let shuttingDown = false;
let notifications: NotificationService | undefined;
const usageMeter = new UsageMeter({
	logger,
	warn: notifyQuotaWarning(getNotificationService),
});
// Callbacks and inbox forwards count against the owners' monthly quota.
outboundQueue.configure(logger, usageMeter);
const backgroundJobs = createBackgroundJobs(logger, {
	watchDigest: env.COMMENTS_ENABLED,
});
const mcpHandlers = new McpHandlerRegistry();

async function shutdown(reason: string, exitCode: number): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info({ reason }, "Shutting down");
	const steps = shutdownSteps({
		outboundQueue,
		// The HTTP servers wait for open streams (MCP and log SSE).
		closeStreams: async () => {
			closeLogStreams();
			await mcpHandlers.closeAll((error) =>
				logger.warn({ err: error }, "Closing an MCP handler failed"),
			);
		},
		usageMeter,
		requestLog,
		closeServers: () => Promise.all(servers.map(closeServer)).then(() => {}),
		// Background Web Push / Telegram deliveries (owner alerts included).
		drain: () => backgroundJobs.stop().then(() => notifications?.drain()),
		disconnect: disconnectMongo,
	});
	const outcome = await runShutdownSteps(
		steps,
		SHUTDOWN_TIMEOUT_MS,
		(step, error) => logger.error({ err: error, step }, "Shutdown step failed"),
	);
	if (!outcome.finished) {
		logger.error(
			{ step: outcome.cutAt },
			"Graceful shutdown timed out; forcing exit",
		);
		process.exit(1);
	}
	logger.info("Shutdown complete");
	process.exit(outcome.failed.length > 0 ? 1 : exitCode);
}

process.once("SIGTERM", () => void shutdown("SIGTERM", 0));
process.once("SIGINT", () => void shutdown("SIGINT", 0));
process.on("unhandledRejection", (reason) => {
	logger.fatal({ err: reason }, "Unhandled promise rejection");
	void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
	logger.fatal({ err: error }, "Uncaught exception");
	void shutdown("uncaughtException", 1);
});

// Fail fast without MongoDB: every feature after this phase needs it, and a
// supervisor (PM2, Compose) restarts the process once the database is back.
try {
	await connectMongo(env.MONGO_URI, logger);
	// Fail fast when an index (unique invariants) cannot be built; old
	// documents get the primary tenant first.
	await migrateToTenants(logger, env.IDP_INTERNAL_URL !== undefined);
	configureRuntime(runtimeSettingsFromEnv(env));
	configureTenancy(env, logger);
	notifications = createNotificationService(env, logger);
	setNotificationService(notifications);
	const auth = createAuthModule(authSettingsFromEnv(env), logger);
	// Off, Tunelo is never called: its operations are not served and the
	// proxy routes a local target through saved tunnel URLs only.
	if (env.TUNELO_ACCOUNTS_ENABLED) {
		configureTunelo(auth, env.TUNELO_API_URL, logger);
	}
	const allowedOrigins = [env.PUBLIC_URL, env.WEB_ORIGIN];
	const operations = servedOperations(registeredOperations, {
		publicSharing: env.PUBLIC_SHARING_ENABLED,
		comments: env.COMMENTS_ENABLED,
		forks: env.FORKS_ENABLED,
		tuneloAccounts: env.TUNELO_ACCOUNTS_ENABLED,
		liveMockSync: env.LIVE_MOCK_SYNC_ENABLED,
	});
	const dashboard = createDashboardApp({
		logger,
		operations,
		trustProxy: env.TRUST_PROXY,
		allowedOrigins,
		auth,
		mcp: createLocalmanMcpRouter({
			operations,
			publicUrl: env.PUBLIC_URL,
			issuer: env.OIDC_ISSUER,
			keys: auth.oidc,
			allowedOrigins,
			logger,
			handlers: mcpHandlers,
		}),
	});
	servers.push(await listen(dashboard, env.DASHBOARD_PORT, env.HOST));
	logger.info(
		{ host: env.HOST, port: env.DASHBOARD_PORT },
		"Dashboard API listening",
	);
	usageMeter.start();
	requestLog.start();
	outboundQueue.start();
	const mock = createMockApp({
		logger,
		usageMeter,
		mcpHandlers,
		trustProxy: env.TRUST_PROXY,
		rateLimits: {
			perSecret: env.MOCK_RATE_LIMIT_PER_SECRET,
			perIp: env.MOCK_RATE_LIMIT_PER_IP,
			writesPerSecret: env.MOCK_WRITE_RATE_LIMIT_PER_SECRET,
			responseBytesPerSecret: env.MOCK_RESPONSE_BYTES_PER_SECOND,
		},
	});
	servers.push(await listen(mock, env.MOCK_PORT, env.HOST));
	logger.info(
		{ host: env.HOST, port: env.MOCK_PORT },
		"Mock runtime listening",
	);
	// Tombstone sweep, trial reminders, trash purge, watch digest.
	backgroundJobs.start();
} catch (error) {
	logger.fatal({ err: error }, "Startup failed");
	await shutdown("startup failure", 1);
}
