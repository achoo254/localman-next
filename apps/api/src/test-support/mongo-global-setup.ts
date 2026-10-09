import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		/** URI of the shared in-memory replica set; each file picks a database. */
		mongoUri: string;
	}
}

/**
 * One in-memory single-node replica set for the whole run (resource data is
 * replaced inside multi-document transactions, which need a replica set);
 * test files isolate by database.
 */
export default async function setup(
	project: TestProject,
): Promise<() => Promise<void>> {
	const replSet = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
		instanceOpts: [{ args: ["--syncdelay", "2"] }],
	});
	project.provide("mongoUri", replSet.getUri());
	return async () => {
		await replSet.stop();
	};
}
