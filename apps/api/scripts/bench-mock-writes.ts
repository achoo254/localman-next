/**
 * Measures concurrent mock writes on a nearly full resource:
 * `pnpm --filter @localman/api bench:mock-writes [patches] [records]`
 * (default 60 PATCH in parallel on a resource of 999 records of ~2 KB).
 *
 * Reports wall time, latency percentiles, statuses, and the MongoDB
 * commands the PATCH phase sent (by name, retries included) with the
 * documents those commands returned. Rate limits are lifted so every
 * PATCH reaches the database. Starts and stops its own in-memory
 * replica set and server; prints JSON.
 */
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { resourceCreateSchema } from "@localman/shared";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../src/config/runtime-settings.js";
import { initModels } from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import { createMockApp } from "../src/mock-server.js";
import { UsageMeter } from "../src/modules/mock-runtime/usage-meter.js";
import { createOwnedProject } from "../src/modules/projects/project-service.js";
import { replaceResourceData } from "../src/modules/resources/resource-data-service.js";
import { createResource } from "../src/modules/resources/resource-service.js";
import { UserModel } from "../src/modules/users/user-model.js";

const logger = createLogger("silent");
const UNLIMITED = 1_000_000;

interface CommandStats {
	commands: Record<string, number>;
	documentsReturned: number;
}

/** Counts commands and returned documents while `recording` is on. */
function watchCommands(): { stats: CommandStats; record(on: boolean): void } {
	const stats: CommandStats = { commands: {}, documentsReturned: 0 };
	let recording = false;
	const client = mongoose.connection.getClient();
	client.on("commandStarted", (event) => {
		if (!recording) return;
		stats.commands[event.commandName] =
			(stats.commands[event.commandName] ?? 0) + 1;
	});
	client.on("commandSucceeded", (event) => {
		if (!recording) return;
		const reply: unknown = event.reply;
		if (typeof reply !== "object" || reply === null || !("cursor" in reply)) {
			return;
		}
		const cursor: unknown = reply.cursor;
		if (typeof cursor !== "object" || cursor === null) return;
		for (const key of ["firstBatch", "nextBatch"]) {
			const batch: unknown = Reflect.get(cursor, key);
			if (Array.isArray(batch)) stats.documentsReturned += batch.length;
		}
	});
	return {
		stats,
		record: (on) => {
			recording = on;
		},
	};
}

async function seed(records: number): Promise<string> {
	const owner = "acc_bench_owner";
	await UserModel.create({ sub: owner, username: "bench" });
	const project = await createOwnedProject(owner, {
		name: "Bench",
		prefix: "",
	});
	const { resource } = await createResource(
		project,
		resourceCreateSchema.parse({ name: "items" }),
	);
	const text = "x".repeat(1_900);
	await replaceResourceData(
		project,
		resource._id.toHexString(),
		Array.from({ length: records }, (_, index) => ({ text, rank: index })),
		false,
	);
	return project.secret;
}

function percentile(sorted: readonly number[], share: number): number {
	const index = Math.max(0, Math.ceil(share * sorted.length) - 1);
	return Math.round((sorted[index] ?? 0) * 10) / 10;
}

async function main(): Promise<void> {
	const [patches = 60, records = 999] = process.argv
		.slice(2)
		.map(Number)
		.filter((value) => Number.isInteger(value) && value > 0);
	const replSet = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	try {
		await mongoose.connect(replSet.getUri("localman_bench"), {
			monitorCommands: true,
		});
		await initModels();
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			mockBaseDomain: "bench.test",
		});
		const secret = await seed(records);
		const usageMeter = new UsageMeter({ logger, warn: async () => {} });
		const app = createMockApp({
			logger,
			usageMeter,
			rateLimits: {
				perSecret: UNLIMITED,
				perIp: UNLIMITED,
				writesPerSecret: UNLIMITED,
				responseBytesPerSecret: Number.MAX_SAFE_INTEGER,
			},
		});
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		if (address === null || typeof address === "string") {
			throw new Error("Server has no TCP address");
		}
		const base = `http://127.0.0.1:${address.port}/m/${secret}/items`;
		const watcher = watchCommands();
		watcher.record(true);
		const started = performance.now();
		const results = await Promise.all(
			Array.from({ length: patches }, async (_, index) => {
				const begin = performance.now();
				const res = await fetch(`${base}/${(index % records) + 1}`, {
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ touched: index }),
				});
				await res.arrayBuffer();
				return { status: res.status, ms: performance.now() - begin };
			}),
		);
		const wallMs = Math.round(performance.now() - started);
		watcher.record(false);
		server.close();
		await usageMeter.stop();
		await mongoose.disconnect();
		const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
		const statuses: Record<string, number> = {};
		for (const { status } of results) {
			statuses[status] = (statuses[status] ?? 0) + 1;
		}
		const report = {
			patches,
			records,
			wallMs,
			p50Ms: percentile(sorted, 0.5),
			p95Ms: percentile(sorted, 0.95),
			statuses,
			mongo: watcher.stats,
		};
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} finally {
		await replSet.stop();
	}
}

await main();
