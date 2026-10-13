import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { OutboundJobModel } from "../mock-callbacks/outbound-job-model.js";
import type { StoredDelivery } from "../mock-callbacks/outbound-send.js";
import { registerProjectDependent } from "../projects/project-dependents.js";

/** What an inbox answers every request with. */
export interface InboxResponse {
	readonly status: number;
	readonly contentType: string;
	readonly body: string;
}

/** Where an inbox forwards: the owner's tunnel of `localhost:<port>`. */
export interface InboxForward {
	readonly port: number;
	readonly path: string;
}

/** A `webhook_inboxes` document. */
export interface StoredInbox {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	/** Slug, unique in the project: `/_inbox/<name>`. */
	readonly name: string;
	readonly response: InboxResponse;
	readonly forward: InboxForward | null;
	/** How the last forward ended. */
	readonly lastForward: StoredDelivery | null;
	readonly createdAt: Date;
}

/**
 * Webhook inboxes of a project, counted against the owner plan's
 * `webhookInboxes` per project. The mock runtime answers
 * `/_inbox/<name>` with `response` and, when `forward` is set, queues a
 * copy of the request for the owner's tunnel.
 */
const inboxSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		name: { type: String, required: true },
		response: {
			status: { type: Number, required: true },
			contentType: { type: String, required: true },
			body: { type: String, default: "" },
		},
		forward: {
			type: new Schema(
				{
					port: { type: Number, required: true },
					path: { type: String, required: true },
				},
				{ _id: false },
			),
			default: null,
		},
		lastForward: { type: Schema.Types.Mixed, default: null },
	},
	{ collection: "webhook_inboxes", versionKey: false, timestamps: true },
);
inboxSchema.index({ projectId: 1, name: 1 }, { unique: true });

inboxSchema.plugin(tenantScopePlugin);
export const InboxModel = mongoose.model("WebhookInbox", inboxSchema);

// Inboxes go with their project, waiting forwards too. A clone starts
// without them: their URLs and tunnel belong to the source's owner.
registerProjectDependent({
	kind: "webhookInboxes",
	count: (projectId) => InboxModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await InboxModel.deleteMany({ projectId });
		await OutboundJobModel.deleteMany({ projectId, kind: "inbox" });
	},
});
