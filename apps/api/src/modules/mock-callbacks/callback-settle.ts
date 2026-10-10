import { recordCallbackLine } from "./callback-message.js";
import { CallbackConfigModel } from "./callback-model.js";
import { bytesOf } from "./job-project.js";
import type { JobSettler } from "./outbound-job-run.js";
import { deliveryOf } from "./outbound-send.js";
import { targetOf } from "./outbound-target.js";

/**
 * A callback delivery is over: one `callback` log line with its attempts,
 * and the result kept as the callback's last (when it still exists).
 */
export const settleCallback: JobSettler = async (job, result, project) => {
	const target = targetOf(job.target);
	if (target) {
		const message = {
			target,
			query: "",
			method: job.method,
			headers: job.headers,
			body: bytesOf(job.body),
		};
		recordCallbackLine(project, job.at, job.event, message, result);
	}
	if (!job.resourceId || !job.callbackId) return;
	await CallbackConfigModel.updateOne(
		{ resourceId: job.resourceId, "callbacks.id": job.callbackId },
		{ $set: { "callbacks.$.last": deliveryOf(result) } },
	);
};
