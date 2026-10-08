import type { Server } from "node:http";
import type { Express } from "express";
import { type Env, parseEnv } from "./config/env.js";
import { createDashboardApp } from "./dashboard-server.js";
import { connectMongo, disconnectMongo } from "./db/connect-mongo.js";
import { type Logger, createLogger } from "./logger.js";
import { createMockApp } from "./mock-server.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

function loadEnvOrExit(): Env {
	try {
		return parseEnv(process.env);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		createLogger("info").fatal(message);
		process.exit(1);
	}
}

function listen(app: Express, port: number): Promise<Server> {
	return new Promise((resolve, reject) => {
		const server = app.listen(port);
		server.once("error", reject);
		server.once("listening", () => {
			server.off("error", reject);
			resolve(server);
		});
	});
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
		server.closeIdleConnections();
	});
}

const env = loadEnvOrExit();
const logger: Logger = createLogger(env.LOG_LEVEL);
const servers: Server[] = [];
let shuttingDown = false;

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
		await Promise.all(servers.map(closeServer));
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
	servers.push(
		await listen(createDashboardApp({ logger }), env.DASHBOARD_PORT),
	);
	logger.info({ port: env.DASHBOARD_PORT }, "Dashboard API listening");
	servers.push(await listen(createMockApp({ logger }), env.MOCK_PORT));
	logger.info({ port: env.MOCK_PORT }, "Mock runtime listening");
} catch (error) {
	logger.fatal({ err: error }, "Startup failed");
	await shutdown("startup failure", 1);
}
