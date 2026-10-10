import type { ServerResponse } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { Types } from "mongoose";
import { afterEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	RequestLogModel,
	type StoredRequestLog,
} from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { MAX_PENDING_PER_OWNER, enqueueJobs } from "./outbound-enqueue.js";
import { JOB_TTL_MS, OutboundJobModel, newJob } from "./outbound-job-model.js";
import { OutboundQueue } from "./retry-queue.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();
const OTHER = "acc_outbound_other";

const hanging: ServerResponse[] = [];
afterEach(() => {
	for (const res of hanging.splice(0)) res.end();
});

/** A callback job of `owner`'s project to the fake tunnel's `path`. */
function job(projectId: string, owner: string, path: string, at = new Date()) {
	const ref = {
		kind: "callback" as const,
		projectId: new Types.ObjectId(projectId),
		owner,
		event: "create" as const,
	};
	const message = {
		target: { kind: "tunnel" as const, port: 3000, path },
		query: "",
		method: "POST",
		headers: [],
		body: Buffer.from("{}"),
	};
	return newJob(ref, message, at);
}

async function otherProject(): Promise<string> {
	await UserModel.create({ sub: OTHER, username: "other" });
	const created = await as(OTHER).send("post", "/projects", { name: "B" });
	expect(created.status).toBe(201);
	return created.body.id;
}

async function callbackLines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find({ source: "callback" })
		.sort({ _id: 1 })
		.lean<StoredRequestLog[]>();
}

describe("outbound queue limits", () => {
	it("gives each owner 2 slots, so a stuck owner never blocks another", async () => {
		outbound.server.routes.set("/hang", (_req, res) => {
			hanging.push(res);
		});
		outbound.answer("/ok", 200);
		const a = await createMockProject();
		const b = await otherProject();
		const stuck = [1, 2, 3, 4].map(() => job(a.id, OWNER, "/hang"));
		await enqueueJobs(OWNER, stuck);
		await enqueueJobs(OTHER, [job(b, OTHER, "/ok")]);

		const queue = new OutboundQueue({
			deps: outbound.deps,
			pollMs: 10,
			concurrency: 4,
			perOwner: 2,
		});
		queue.start();
		for (let i = 0; i < 200 && outbound.received.length === 0; i++) {
			await sleep(10);
		}
		expect(outbound.received.map((r) => r.url)).toEqual(["/ok"]);
		expect(hanging).toHaveLength(2);
		await queue.stop();
		// The stuck owner's jobs wait for the next start, none lost.
		expect(await OutboundJobModel.countDocuments({ owner: OWNER })).toBe(4);
	});

	it("refuses a callback past the owner's pending cap as queue_full", async () => {
		const a = await createMockProject();
		const b = await otherProject();
		const filler = Array.from({ length: MAX_PENDING_PER_OWNER }, () =>
			job(a.id, OWNER, "/later"),
		);
		await OutboundJobModel.insertMany(filler);
		await OutboundJobModel.insertMany([job(b, OTHER, "/other")]);
		const users = await createResource(OWNER, a.id, { name: "users" });
		const set = await as(OWNER).send(
			"put",
			`/projects/${a.id}/resources/${users.id}/callbacks`,
			{
				callbacks: [
					{ on: "create", target: { kind: "tunnel", port: 3000, path: "/h" } },
				],
			},
		);
		expect(set.status).toBe(200);
		await kit.client(a.secret).call("post", "/users", { name: "Ada" });
		await outbound.queue().stop();

		const [line] = await callbackLines();
		expect(line?.attempts?.map((attempt) => attempt.error)).toEqual([
			"queue_full",
		]);
		// Nobody's waiting job was removed to make room.
		expect(await OutboundJobModel.countDocuments({ owner: OWNER })).toBe(
			MAX_PENDING_PER_OWNER,
		);
		expect(await OutboundJobModel.countDocuments({ owner: OTHER })).toBe(1);
	});

	it("logs a job past its deadline as expired instead of dropping it", async () => {
		outbound.answer("/late", 200);
		const a = await createMockProject();
		const old = new Date(Date.now() - JOB_TTL_MS - 1_000);
		await enqueueJobs(OWNER, [job(a.id, OWNER, "/late", old)]);
		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(0);
		const [line] = await callbackLines();
		expect(line).toMatchObject({ status: 0, at: old });
		expect(line?.attempts?.map((attempt) => attempt.error)).toEqual([
			"expired",
		]);
	});
});
