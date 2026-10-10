import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		/** URI of the shared in-memory MongoDB; each file picks a database. */
		mongoUri: string;
	}
}

/** One in-memory MongoDB for the whole run; test files isolate by database. */
export default async function setup(
	project: TestProject,
): Promise<() => Promise<void>> {
	const server = await MongoMemoryServer.create();
	project.provide("mongoUri", server.getUri());
	return async () => {
		await server.stop();
	};
}
