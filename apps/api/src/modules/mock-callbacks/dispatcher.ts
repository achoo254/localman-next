import type { JsonValue } from "@localman/shared";
import type { Types } from "mongoose";
import type { CallbackEvent } from "../mock-runtime/request-log-model.js";
import { renderCallback } from "./callback-message.js";
import {
	CallbackConfigModel,
	type StoredCallbackConfig,
} from "./callback-model.js";
import { settleCallback } from "./callback-settle.js";
import { loadJobProject } from "./job-project.js";
import { enqueueJobs } from "./outbound-enqueue.js";
import { newJob } from "./outbound-job-model.js";
import { failedDelivery } from "./outbound-send.js";
import { trackOutbound } from "./outbound-tracking.js";

/** The resource a record event happened in. */
export interface EventResource {
	readonly _id: Types.ObjectId;
	readonly name: string;
}

async function enqueue(
	projectId: Types.ObjectId,
	resource: EventResource,
	event: CallbackEvent,
	record: JsonValue,
): Promise<void> {
	const config = await CallbackConfigModel.findOne({
		resourceId: resource._id,
		projectId,
	}).lean<StoredCallbackConfig>();
	const due = (config?.callbacks ?? []).filter(
		(callback) => callback.enabled && callback.on === event,
	);
	if (due.length === 0) return;
	const project = await loadJobProject(projectId);
	if (!project) return;
	const at = new Date();
	const context = { event, resource: resource.name, record };
	const jobs = due.map((callback) => {
		const { message, failure } = renderCallback(callback, context);
		const ref = {
			kind: "callback" as const,
			projectId,
			owner: project.owner,
			resourceId: resource._id,
			callbackId: callback.id,
			event,
			...(failure ? { failure } : {}),
		};
		return newJob(ref, message, at);
	});
	const { rejected } = await enqueueJobs(project.owner, jobs);
	// The owner sees a refused event in the log and as the callback's last.
	for (const job of rejected) {
		await settleCallback(job, failedDelivery([], "queue_full"), project);
	}
}

/**
 * Queues the enabled callbacks of `event` on the resource, rendered with
 * the record now, without holding the mock's response: the work runs in
 * the background and a failure is only logged. Past the owner's pending
 * cap an event is not queued but logged as `queue_full`. Called by the
 * mock runtime after a create, update or delete (REST and Hosted Mock
 * MCP); dashboard edits of data never fire callbacks.
 */
export function dispatchRecordEvent(
	projectId: Types.ObjectId,
	resource: EventResource,
	event: CallbackEvent,
	record: JsonValue,
): void {
	trackOutbound(enqueue(projectId, resource, event, record));
}
