import type { Server } from "node:http";

/** How often idle keep-alive connections are dropped while closing. */
const IDLE_SWEEP_MS = 100;

/**
 * Stops accepting connections and resolves once the open ones ended.
 * Idle keep-alive connections are dropped at once and again every
 * `IDLE_SWEEP_MS`: a response that finishes during shutdown (an MCP
 * stream ended by `handler.close()`, a slow request) leaves its connection
 * idle, and it would otherwise wait for the keep-alive timeout.
 */
export function closeServer(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		const sweep = setInterval(
			() => server.closeIdleConnections(),
			IDLE_SWEEP_MS,
		);
		sweep.unref();
		server.close((error) => {
			clearInterval(sweep);
			if (error) reject(error);
			else resolve();
		});
		server.closeIdleConnections();
	});
}
