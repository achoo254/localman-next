import type { Express } from "express";
import { createBaseApp } from "./http/create-base-app.js";
import type { Logger } from "./logger.js";

export interface MockAppOptions {
	readonly logger: Logger;
}

/**
 * Public mock runtime (port 4100). Only `/healthz` exists until the mock
 * runtime routes land; building the app never opens a socket.
 */
export function createMockApp(options: MockAppOptions): Express {
	return createBaseApp({ logger: options.logger });
}
