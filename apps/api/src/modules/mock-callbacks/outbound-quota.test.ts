import { limitsFor } from "@localman/shared";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { incrementUsage, readUsage } from "../billing/usage-counter-model.js";
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
import { enqueueJobs } from "./outbound-enqueue.js";
import { type OutboundJobKind, newJob } from "./outbound-job-model.js";
import { OutboundQueue } from "./retry-queue.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();

/** A job of the owner's project to the fake tunnel's `path`. */
async function queueJob(kind: OutboundJobKind, path: string) {
	const project = await createMockProject();
	const ref = {
		kind,
		projectId: new Types.ObjectId(project.id),
		owner: OWNER,
		...(kind === "inbox" ? { lineId: new Types.ObjectId() } : {}),
	};
	const message = {
		target: { kind: "tunnel" as const, port: 3000, path },
		query: "",
		method: "POST",
		headers: [],
		body: Buffer.from("{}"),
	};
	await enqueueJobs(OWNER, [newJob(ref, message, new Date())]);
}

/** A queue charging the kit's meter, like the one `main.ts` configures. */
function meteredQueue(): OutboundQueue {
	return new OutboundQueue({
		deps: outbound.deps,
		pollMs: 10,
		meter: kit.meter(),
	});
}

async function callbackLines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find({ source: "callback" }).lean<
		StoredRequestLog[]
	>();
}

describe("outbound deliveries and the monthly quota", () => {
	it("counts each callback and inbox forward once, whatever its attempts", async () => {
		outbound.answer("/fail", 503);
		outbound.answer("/ok", 200);
		await queueJob("callback", "/fail");
		await queueJob("inbox", "/ok");
		const queue = meteredQueue();
		await queue.drain();
		await queue.stop();
		// 3 attempts to /fail, 1 to /ok: two deliveries.
		expect(outbound.received).toHaveLength(4);
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(2);
	});

	it("sends nothing once the quota is used up and logs quota_exceeded", async () => {
		outbound.answer("/hook", 200);
		const limit = limitsFor("free").mockRequestsPerMonth ?? 0;
		await incrementUsage(OWNER, "mockRequests", limit, new Date());
		await queueJob("callback", "/hook");
		await queueJob("inbox", "/hook");
		const queue = meteredQueue();
		await queue.drain();
		await queue.stop();
		expect(outbound.received).toHaveLength(0);
		const [line] = await callbackLines();
		expect(line?.attempts?.map((attempt) => attempt.error)).toEqual([
			"quota_exceeded",
		]);
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(limit);
	});
});
