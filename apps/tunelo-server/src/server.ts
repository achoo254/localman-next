import http from "node:http";
import { DEFAULTS } from "@tunelo/shared";
import express from "express";
import { createApiRouter } from "./api/create-api-router.js";
import { renderLoginPage } from "./api/render-login-page.js";
import { createKeyStore } from "./key-store/create-key-store.js";
import { createLogger } from "./logger.js";
import { createRelayHandler } from "./request-relay.js";
import * as deviceLogin from "./services/device-login-service.js";
import { usageTracker } from "./services/usage-tracker.js";
import { tunnelManager } from "./tunnel-manager.js";
import { attachWsHandler } from "./ws-handler.js";

const logger = createLogger("tunelo-server");

const port = Number(process.env.TUNNEL_PORT) || DEFAULTS.SERVER_PORT;

const keyStore = createKeyStore();

async function start(): Promise<void> {
	await keyStore.initialize();
	usageTracker.start();

	const app = express();

	// Mount API router (device pairing + token verify)
	const apiRouter = createApiRouter();
	app.use("/api", apiRouter);

	// Browser pairing page for `tunelo login` — creates a session and renders
	// the code the user pastes into their terminal.
	app.get("/login", async (_req, res, next) => {
		try {
			const { code } = await deviceLogin.createSession();
			res.type("html").send(renderLoginPage(code));
		} catch (err) {
			next(err);
		}
	});

	// Catch-all: relay handler gets raw req/res (no Express middleware)
	const relay = createRelayHandler();
	app.use((req, res) => relay(req, res));

	const server = http.createServer(app);
	attachWsHandler(server, keyStore);

	server.listen(port, () => {
		logger.info("=".repeat(50));
		logger.info(
			{ port, nodeVersion: process.version, pid: process.pid },
			"Tunelo server started",
		);
		logger.info("=".repeat(50));
	});

	function shutdown(signal: string): void {
		logger.info({ signal }, "Shutting down");
		tunnelManager.closeAll();
		server.close(async () => {
			await usageTracker.stop();
			await keyStore.shutdown();
			logger.info("Server closed");
			process.exit(0);
		});
		setTimeout(() => process.exit(1), 5000).unref();
	}

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
	logger.fatal({ err }, "Failed to start server");
	process.exit(1);
});
