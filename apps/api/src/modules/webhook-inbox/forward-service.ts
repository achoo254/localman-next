import type { Request } from "express";
import type { Types } from "mongoose";
import { fromRawHeaders } from "../api-client/proxy-headers.js";
import { loadJobProject } from "../mock-callbacks/job-project.js";
import { enqueueJobs } from "../mock-callbacks/outbound-enqueue.js";
import { newJob } from "../mock-callbacks/outbound-job-model.js";
import type { JobSettler } from "../mock-callbacks/outbound-job-run.js";
import { deliveryOf, failedDelivery } from "../mock-callbacks/outbound-send.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import { upstreamRequestHeaders } from "../mock-runtime/upstream-headers.js";
import { type InboxForward, InboxModel } from "./inbox-model.js";

export interface ForwardRequest {
	readonly projectId: Types.ObjectId;
	readonly inboxId: Types.ObjectId;
	readonly forward: InboxForward;
	/** The inbox request's log line, completed with the attempts. */
	readonly lineId: Types.ObjectId;
	readonly body: Buffer | null;
}

/**
 * Queues a copy of the inbox request for the owner's tunnel: same method,
 * query and body, the sender's headers minus hop-by-hop, `Host` and
 * infrastructure ones, plus `X-Localman-Hop: 1` (a tunnel that leads back
 * to an inbox is not forwarded again). Past the owner's pending cap the
 * request is not forwarded: its line gets a `queue_full` attempt.
 */
export async function enqueueInboxForward(
	req: Request,
	request: ForwardRequest,
): Promise<void> {
	const { projectId, inboxId, forward, lineId, body } = request;
	const project = await loadJobProject(projectId);
	if (!project) return;
	const message = {
		target: { kind: "tunnel" as const, port: forward.port, path: forward.path },
		query: req.originalUrl.split("?").slice(1).join("?"),
		method: req.method,
		headers: upstreamRequestHeaders(fromRawHeaders(req.rawHeaders)),
		body,
	};
	const ref = {
		kind: "inbox" as const,
		projectId,
		owner: project.owner,
		inboxId,
		lineId,
	};
	const job = newJob(ref, message, new Date());
	const { rejected } = await enqueueJobs(project.owner, [job]);
	if (rejected.length > 0) {
		await settleInboxForward(job, failedDelivery([], "queue_full"), project);
	}
}

/**
 * A forward is over: its attempts go onto the inbox request's log line
 * (streamed again, so live views update the row) and become the inbox's
 * last forward.
 */
export const settleInboxForward: JobSettler = async (job, result, project) => {
	if (job.lineId) {
		await requestLog.amend(project.id, job.lineId, result.attempts);
	}
	if (job.inboxId) {
		await InboxModel.updateOne(
			{ _id: job.inboxId, projectId: project.id },
			{ $set: { lastForward: deliveryOf(result) } },
		);
	}
};
