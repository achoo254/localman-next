import type { Logger } from "../../logger.js";
import { settleInboxForward } from "../webhook-inbox/forward-service.js";
import { callbacksGone } from "./callback-model.js";
import { settleCallback } from "./callback-settle.js";
import { type JobProject, bytesOf, loadJobProject } from "./job-project.js";
import {
	type OutboundJobKind,
	OutboundJobModel,
	type StoredOutboundJob,
} from "./outbound-job-model.js";
import {
	type AttemptOutcome,
	type DeliveryResult,
	MAX_ATTEMPTS,
	type OutboundDeps,
	attemptOnce,
	failedDelivery,
} from "./outbound-send.js";
import { targetOf } from "./outbound-target.js";

/** Records a finished delivery (log line, last result). */
export type JobSettler = (
	job: StoredOutboundJob,
	result: DeliveryResult,
	project: JobProject,
) => Promise<void>;

const SETTLERS: Readonly<Record<OutboundJobKind, JobSettler>> = {
	inbox: settleInboxForward,
	callback: settleCallback,
};

/** Records the end of a job (log line, last result), then deletes it. */
export async function settleJob(
	job: StoredOutboundJob,
	result: DeliveryResult,
	project: JobProject,
	logger: Logger,
): Promise<void> {
	try {
		await SETTLERS[job.kind](job, result, project);
	} catch (error) {
		// The delivery itself is over: a failed record is not retried.
		logger.error({ err: error, kind: job.kind }, "Settling a delivery failed");
	}
	await OutboundJobModel.deleteOne({ _id: job._id });
}

/** What running a job needs besides the job. */
export interface JobRunContext {
	readonly deps: OutboundDeps;
	/** Aborted on shutdown: the attempt is cut and the job put back. */
	readonly signal: AbortSignal;
	readonly logger: Logger;
	/** Counts the job against the owner's monthly quota; false once used up. */
	readonly charge: (project: JobProject) => Promise<boolean>;
}

/**
 * Makes the next attempt of a claimed job. A job of a deleted project, or
 * a callback job of a deleted resource, is dropped; one that must not be
 * sent (`failure`, a malformed target) is settled as failed at once. The
 * first attempt counts the job against the owner's monthly quota; with
 * none left it is settled as `quota_exceeded`, unsent. After the attempt
 * the job is due again after its backoff when worth retrying, else
 * settled and deleted. An attempt cut by `signal` (shutdown) is not
 * counted and the job is put back.
 */
export async function runOutboundJob(
	job: StoredOutboundJob,
	{ deps, signal, logger, charge }: JobRunContext,
): Promise<void> {
	const project = await loadJobProject(job.projectId);
	const gone = job.kind === "callback" && (await callbacksGone(job.resourceId));
	if (!project || gone) {
		await OutboundJobModel.deleteOne({ _id: job._id });
		return;
	}
	const target = targetOf(job.target);
	if (job.failure !== null || target === null) {
		const error = job.failure ?? "invalid_target";
		return settleJob(job, failedDelivery(job.attempts, error), project, logger);
	}
	if (!job.charged && !(await charge(project))) {
		const result = failedDelivery(job.attempts, "quota_exceeded");
		return settleJob(job, result, project, logger);
	}
	const message = {
		target,
		query: job.query,
		method: job.method,
		headers: job.headers,
		body: bytesOf(job.body),
	};
	let outcome: AttemptOutcome | null = null;
	try {
		outcome = await attemptOnce(message, project.owner, deps, signal);
	} catch (error) {
		if (!signal.aborted) throw error;
	}
	if (signal.aborted || outcome === null) {
		await OutboundJobModel.updateOne(
			{ _id: job._id },
			{
				$set: {
					state: "pending",
					charged: true,
					nextAt: new Date(),
					lockedUntil: null,
				},
			},
		);
		return;
	}
	const attempts = [...job.attempts, outcome.attempt];
	if (outcome.retry && attempts.length < MAX_ATTEMPTS) {
		const wait = deps.backoffMs[attempts.length - 1] ?? 0;
		await OutboundJobModel.updateOne(
			{ _id: job._id },
			{
				$set: {
					state: "pending",
					charged: true,
					attempts,
					nextAt: new Date(Date.now() + wait),
					lockedUntil: null,
				},
			},
		);
		return;
	}
	await settleJob(
		job,
		{ attempts, response: outcome.response },
		project,
		logger,
	);
}

/**
 * Settles a job past its `deadlineAt` as `expired` (log line, last
 * result) instead of letting the TTL index drop it unseen; a job of a
 * deleted project is only deleted.
 */
export async function expireOutboundJob(
	job: StoredOutboundJob,
	logger: Logger,
): Promise<void> {
	const project = await loadJobProject(job.projectId);
	if (!project) {
		await OutboundJobModel.deleteOne({ _id: job._id });
		return;
	}
	await settleJob(
		job,
		failedDelivery(job.attempts, "expired"),
		project,
		logger,
	);
}
