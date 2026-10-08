import mongoose from "mongoose";
import type { Logger } from "../logger.js";

export type DbState =
	| "disconnected"
	| "connected"
	| "connecting"
	| "disconnecting"
	| "uninitialized";

const READY_STATES: Readonly<Record<number, DbState>> = {
	0: "disconnected",
	1: "connected",
	2: "connecting",
	3: "disconnecting",
	99: "uninitialized",
};

let listenersAttached = false;

/** Hides credentials so the URI can be logged. */
export function redactMongoUri(uri: string): string {
	return uri.replace(/\/\/[^@/]*@/, "//[redacted]@");
}

export function getDbState(): DbState {
	return READY_STATES[mongoose.connection.readyState] ?? "uninitialized";
}

function attachConnectionLogging(logger: Logger): void {
	if (listenersAttached) return;
	listenersAttached = true;
	mongoose.connection.on("disconnected", () => {
		logger.warn("MongoDB disconnected");
	});
	mongoose.connection.on("reconnected", () => {
		logger.info("MongoDB reconnected");
	});
	mongoose.connection.on("error", (err: unknown) => {
		logger.error({ err }, "MongoDB connection error");
	});
}

/**
 * Opens the shared mongoose connection. Rejects when no server is reachable
 * within `serverSelectionTimeoutMS`; later drops are retried by the driver.
 */
export async function connectMongo(
	uri: string,
	logger: Logger,
	serverSelectionTimeoutMS = 5_000,
): Promise<void> {
	const target = redactMongoUri(uri);
	logger.info({ uri: target }, "Connecting to MongoDB");
	try {
		await mongoose.connect(uri, { serverSelectionTimeoutMS });
	} catch (error) {
		throw new Error(`Cannot connect to MongoDB at ${target}`, { cause: error });
	}
	// Attached after the first connect so a startup failure is logged once.
	attachConnectionLogging(logger);
	logger.info({ uri: target }, "MongoDB connected");
}

export async function disconnectMongo(): Promise<void> {
	await mongoose.disconnect();
}
