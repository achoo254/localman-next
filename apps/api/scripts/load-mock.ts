/**
 * Quick load test of the mock runtime against a local in-memory MongoDB
 * replica set: `pnpm --filter @localman/api load:mock [underSeconds]
 * [overSeconds]` (default 20 + 10 = 30 seconds).
 *
 * 1. Under the limits: 25 requests/second from one client (the per-IP
 *    limit is 30/s) on a list page and a single record; reports p95
 *    latency, which must stay under 50 ms, and expects no 429.
 * 2. Over the limits: as fast as 20 connections go; reports the share of
 *    429 answers.
 *
 * Starts and stops its own database and server; prints JSON.
 */
import { once } from "node:events";
import { resourceCreateSchema } from "@localman/shared";
import autocannon from "autocannon";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../src/config/runtime-settings.js";
import {
	connectMongo,
	disconnectMongo,
	initModels,
} from "../src/db/connect-mongo.js";
import { createLogger } from "../src/logger.js";
import { DEFAULT_MOCK_RATE_LIMITS, createMockApp } from "../src/mock-server.js";
import { UsageMeter } from "../src/modules/mock-runtime/usage-meter.js";
import { createOwnedProject } from "../src/modules/projects/project-service.js";
import { generateResourceData } from "../src/modules/resources/resource-data-service.js";
import { createResource } from "../src/modules/resources/resource-service.js";
import { UserModel } from "../src/modules/users/user-model.js";

const P95_BUDGET_MS = 50;
const logger = createLogger("silent");

interface PhaseReport {
	readonly requests: number;
	readonly p50Ms: number;
	readonly p95Ms: number;
	readonly p99Ms: number;
	readonly statuses: Record<string, number>;
	readonly rateLimitedShare: number;
}

function percentile(sorted: readonly number[], share: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.min(
		sorted.length - 1,
		Math.ceil(share * sorted.length) - 1,
	);
	return Math.round((sorted[Math.max(0, index)] ?? 0) * 100) / 100;
}

/** Runs autocannon, collecting each response's latency and status. */
function phase(options: autocannon.Options): Promise<PhaseReport> {
	return new Promise((resolve, reject) => {
		const latencies: number[] = [];
		const statuses = new Map<number, number>();
		const instance = autocannon(options, (error) => {
			if (error) {
				reject(error);
				return;
			}
			const sorted = [...latencies].sort((a, b) => a - b);
			const total = latencies.length;
			resolve({
				requests: total,
				p50Ms: percentile(sorted, 0.5),
				p95Ms: percentile(sorted, 0.95),
				p99Ms: percentile(sorted, 0.99),
				statuses: Object.fromEntries(statuses),
				rateLimitedShare:
					total === 0
						? 0
						: Math.round(((statuses.get(429) ?? 0) / total) * 1000) / 1000,
			});
		});
		instance.on("response", (_client, statusCode, _bytes, responseTime) => {
			latencies.push(responseTime);
			statuses.set(statusCode, (statuses.get(statusCode) ?? 0) + 1);
		});
	});
}

/** A Free owner, a project and 100 generated `users`; returns the secret. */
async function seed(): Promise<string> {
	const owner = "acc_load_owner";
	await UserModel.create({ sub: owner, username: "load" });
	const project = await createOwnedProject(owner, { name: "Load", prefix: "" });
	const { resource } = await createResource(
		project,
		resourceCreateSchema.parse({ name: "users" }),
	);
	await generateResourceData(project, resource._id.toHexString(), 100, false);
	return project.secret;
}

async function main(): Promise<void> {
	const [underSeconds = 20, overSeconds = 10] = process.argv
		.slice(2)
		.map(Number)
		.filter((value) => Number.isInteger(value) && value > 0);
	const replSet = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	try {
		await connectMongo(replSet.getUri("localman_load"), logger);
		await initModels();
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			mockBaseDomain: "localtest.me",
		});
		const secret = await seed();
		const usageMeter = new UsageMeter({ logger, warn: async () => {} });
		usageMeter.start();
		const server = createMockApp({ logger, usageMeter }).listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		if (address === null || typeof address === "string") {
			throw new Error("Server has no TCP address");
		}
		const base = `http://127.0.0.1:${address.port}/m/${secret}`;
		const requests = [
			{ method: "GET" as const, path: `/m/${secret}/users?page=2&limit=10` },
			{ method: "GET" as const, path: `/m/${secret}/users/42` },
		];
		const under = await phase({
			url: base,
			requests,
			connections: 5,
			overallRate: 25,
			duration: underSeconds,
		});
		const over = await phase({
			url: base,
			requests,
			connections: 20,
			duration: overSeconds,
		});
		server.close();
		await usageMeter.stop();
		await disconnectMongo();
		const report = {
			limits: DEFAULT_MOCK_RATE_LIMITS,
			underLimits: { ...under, p95WithinBudget: under.p95Ms < P95_BUDGET_MS },
			overLimits: over,
		};
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		const ok =
			report.underLimits.p95WithinBudget &&
			(under.statuses["429"] ?? 0) === 0 &&
			(over.statuses["429"] ?? 0) > 0;
		process.exitCode = ok ? 0 : 1;
	} finally {
		await replSet.stop();
	}
}

await main();
