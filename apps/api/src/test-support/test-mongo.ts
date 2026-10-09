import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { inject } from "vitest";

/**
 * Connects the shared mongoose connection to a fresh database of the
 * in-memory mongod and builds every index (unique ones matter for the
 * tests). Returns the teardown that drops the database.
 */
export async function connectTestMongo(): Promise<() => Promise<void>> {
	const base = inject("mongoUri").replace(/\/$/, "");
	await mongoose.connect(`${base}/lm_${randomUUID().slice(0, 8)}`);
	await Promise.all(
		mongoose.modelNames().map((name) => mongoose.model(name).init()),
	);
	return async () => {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
	};
}

/** Empties every collection between tests. */
export async function clearCollections(): Promise<void> {
	const collections = await mongoose.connection.db?.collections();
	await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
}
