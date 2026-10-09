import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		/** Base URI of the shared in-memory mongod; each file picks a database. */
		mongoUri: string;
	}
}

/** One in-memory mongod for the whole run; test files isolate by database. */
export default async function setup(
	project: TestProject,
): Promise<() => Promise<void>> {
	const mongod = await MongoMemoryServer.create({
		instance: { args: ["--syncdelay", "2"] },
	});
	project.provide("mongoUri", mongod.getUri());
	return async () => {
		await mongod.stop();
	};
}
