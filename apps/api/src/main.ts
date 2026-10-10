import type { Server } from "node:http";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import type { Express } from "express";
import { type Env, parseEnv } from "./config/env.js";
import {
	configureRuntime,
	runtimeSettingsFromEnv,
} from "./config/runtime-settings.js";
import { createDashboardApp } from "./dashboard-server.js";
import {
	connectMongo,
	disconnectMongo,
	initModels,
} from "./db/connect-mongo.js";
import { closeServer } from "./http/close-server.js";
import { type Logger, createLogger } from "./logger.js";
import { configureProxyLogger } from "./modules/api-client/proxy-operations.js";
import { createMockApp } from "./mock-server.js";
import {
	authSettingsFromEnv,
	createAuthModule,
} from "./modules/auth/auth-module.js";
import { createLocalmanMcpRouter } from "./modules/mcp/localman-mcp-server.js";
import { McpHandlerRegistry } from "./modules/mcp/mcp-handler-registry.js";
import { notifyQuotaWarning } from "./modules/mock-runtime/quota-warnings.js";
import { UsageMeter } from "./modules/mock-runtime/usage-meter.js";
import {
	getNotificationService,
	setNotificationService,
} from "./modules/notifications/notification-runtime.js";
import {
	type NotificationService,
	createNotificationService,
} from "./modules/notifications/notification-service.js";
import { TombstoneSweeper } from "./modules/projects/tombstone-sweeper.js";

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
configureProxyLogger(logger);
const servers: Server[] = [];
let shuttingDown = false;
let notifications: NotificationService | undefined;
const usageMeter = new UsageMeter({
	logger,
	warn: notifyQuotaWarning(getNotificationService),
});
const tombstoneSweeper = new TombstoneSweeper(logger);
const mcpHandlers = new McpHandlerRegistry();

async function shutdown(reason: string, exitCode: number): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info({ reason }, "Shutting down");
	const forceExit = setTimeout(() => {
		logger.error("Graceful shutdown timed out; forcing exit");
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);
	forceExit.unref();
	try {
		// End open MCP streams (SSE) first: the HTTP servers wait for them.
		await mcpHandlers.closeAll((error) =>
			logger.warn({ err: error }, "Closing an MCP handler failed"),
		);
		await Promise.all(servers.map(closeServer));
		// Write the mock requests counted since the last flush.
		await usageMeter.stop();
		await tombstoneSweeper.stop();
		// Let background Web Push / Telegram deliveries (owner alerts
		// included) finish their writes.
		await notifications?.drain();
		await disconnectMongo();
		logger.info("Shutdown complete");
		process.exit(exitCode);
	} catch (error) {
		logger.error({ err: error }, "Shutdown failed");
		process.exit(1);
	}
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
	// Fail fast when an index (unique invariants) cannot be built.
	await initModels();
	configureRuntime(runtimeSettingsFromEnv(env));
	notifications = createNotificationService(env, logger);
	setNotificationService(notifications);
	const auth = createAuthModule(authSettingsFromEnv(env), logger);
	const allowedOrigins = [env.PUBLIC_URL, env.WEB_ORIGIN];
	const dashboard = createDashboardApp({
		logger,
		trustProxy: env.TRUST_PROXY,
		allowedOrigins,
		auth,
		mcp: createLocalmanMcpRouter({
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
	// Finishes project deletions cut off by an error or a restart.
	tombstoneSweeper.start();
} catch (error) {
	logger.fatal({ err: error }, "Startup failed");
	await shutdown("startup failure", 1);
}
