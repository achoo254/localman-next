import type { HeaderEntry } from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import type { CallbackEvent } from "../mock-runtime/request-log-model.js";
import { registerProjectDependent } from "../projects/project-dependents.js";
import { registerResourceDependent } from "../resources/resource-dependents.js";
import { OutboundJobModel } from "./outbound-job-model.js";
import type { StoredDelivery } from "./outbound-send.js";
import type { OutboundTarget } from "./outbound-target.js";

/** One callback of a resource. */
export interface StoredCallback {
	readonly id: string;
	readonly on: CallbackEvent;
	readonly target: OutboundTarget;
	readonly bodyTemplate: string;
	readonly headers: HeaderEntry[];
	readonly enabled: boolean;
	readonly last?: StoredDelivery | null;
}

/** A `mock_callbacks` document: the callbacks of one resource. */
export interface StoredCallbackConfig {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly resourceId: Types.ObjectId;
	readonly callbacks: StoredCallback[];
}

const headerSchema = new Schema(
	{ name: { type: String }, value: { type: String } },
	{ _id: false },
);

const callbackSchema = new Schema(
	{
		id: { type: String, required: true },
		on: { type: String, required: true },
		// Validated by `callbackInputSchema` before it is stored.
		target: { type: Schema.Types.Mixed, required: true },
		bodyTemplate: { type: String, default: "" },
		headers: { type: [headerSchema], default: [] },
		enabled: { type: Boolean, default: true },
		last: { type: Schema.Types.Mixed, default: null },
	},
	{ _id: false },
);

/**
 * Mock callbacks per resource, kept apart from the resource document so
 * resource writes, views and clones stay as they are. Only the owner
 * changes them; the mock runtime reads them on every record write.
 */
const callbackConfigSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		resourceId: { type: Schema.Types.ObjectId, required: true },
		callbacks: { type: [callbackSchema], default: [] },
	},
	{ collection: "mock_callbacks", versionKey: false, timestamps: true },
);
callbackConfigSchema.index({ resourceId: 1 }, { unique: true });
callbackConfigSchema.index({ projectId: 1 });

callbackConfigSchema.plugin(tenantScopePlugin);
export const CallbackConfigModel = mongoose.model(
	"CallbackConfig",
	callbackConfigSchema,
);

async function countCallbacks(projectId: Types.ObjectId): Promise<number> {
	const [row] = await CallbackConfigModel.aggregate<{ n: number }>([
		{ $match: { projectId } },
		{ $group: { _id: null, n: { $sum: { $size: "$callbacks" } } } },
	]);
	return row?.n ?? 0;
}

// Callbacks go with their project, waiting deliveries too. A clone does
// not inherit them: they send the source's records to the source
// owner's endpoints.
registerProjectDependent({
	kind: "callbacks",
	count: countCallbacks,
	deleteAll: async (projectId) => {
		await CallbackConfigModel.deleteMany({ projectId });
		await OutboundJobModel.deleteMany({ projectId, kind: "callback" });
	},
});

// A deleted resource (or descendant) takes its callbacks along, and the
// deliveries still waiting: they would send records of a resource that is
// gone. A delivery mid-attempt finishes; the job runner drops any job
// queued for a resource whose callbacks are gone (see `callbacksGone`).
registerResourceDependent({
	kind: "callbacks",
	deleteFor: async (projectId, resourceIds, session) => {
		const resourceId = { $in: [...resourceIds] };
		await CallbackConfigModel.deleteMany(
			{ projectId, resourceId },
			{ session },
		);
		await OutboundJobModel.deleteMany(
			{ projectId, kind: "callback", resourceId },
			{ session },
		);
	},
});

/**
 * The callbacks a job was queued for are gone (resource deleted between
 * reading them and queueing the job): the job must not be sent.
 */
export async function callbacksGone(
	resourceId: Types.ObjectId | undefined,
): Promise<boolean> {
	if (!resourceId) return false;
	return (await CallbackConfigModel.exists({ resourceId })) === null;
}
