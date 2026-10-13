import type { HeaderEntry } from "@localman/shared/api-client";
import mongoose, { Schema, Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import type {
	CallbackEvent,
	StoredAttempt,
} from "../mock-runtime/request-log-model.js";
import type { OutboundMessage } from "./outbound-send.js";

/** `inbox`: a webhook inbox forward; `callback`: a mock callback. */
export type OutboundJobKind = "inbox" | "callback";

/**
 * A job not delivered this long after its event is settled as `expired`
 * by the queue (a log line, the last result), then deleted.
 */
export const JOB_TTL_MS = 60 * 60 * 1000;
/**
 * The TTL index drops a job this long after its deadline: only when no
 * queue ran in between to settle it as `expired`.
 */
export const JOB_PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

/** An `outbound_jobs` document: one delivery and its attempts so far. */
export interface StoredOutboundJob {
	readonly _id: Types.ObjectId;
	readonly kind: OutboundJobKind;
	readonly projectId: Types.ObjectId;
	/** The project owner: queue slots and pending caps are per owner. */
	readonly owner: string;
	/** `OutboundTarget`, checked again when sent. */
	readonly target: unknown;
	readonly query: string;
	readonly method: string;
	readonly headers: HeaderEntry[];
	/** Bytes or `null`; lean reads give a `Binary` (see `bytesOf`). */
	readonly body: unknown;
	/** Set when the job must not be sent (`body_too_large`). */
	readonly failure: string | null;
	/** When the event happened (the log line's time). */
	readonly at: Date;
	/** Inbox: the inbox and the log line its forward completes. */
	readonly inboxId?: Types.ObjectId;
	readonly lineId?: Types.ObjectId;
	/** Callback: which callback of which resource, and the event. */
	readonly resourceId?: Types.ObjectId;
	readonly callbackId?: string;
	readonly event?: CallbackEvent;
	readonly attempts: StoredAttempt[];
	/** Counted against the owner's monthly quota (once per job). */
	readonly charged: boolean;
	readonly state: "pending" | "running";
	/** Due time of the next attempt. */
	readonly nextAt: Date;
	/** A running job past this is taken again (its worker died). */
	readonly lockedUntil: Date | null;
	/** Past it the job is settled as `expired` instead of sent. */
	readonly deadlineAt: Date;
	/** TTL: removed by Mongo if still there (no queue ran). */
	readonly purgeAt: Date;
}

const headerSchema = new Schema(
	{ name: { type: String }, value: { type: String } },
	{ _id: false },
);

const attemptSchema = new Schema(
	{
		at: { type: Date, required: true },
		status: { type: Number },
		error: { type: String },
		ms: { type: Number, required: true },
	},
	{ _id: false },
);

/**
 * Deliveries waiting for the worker of `retry-queue.ts`. A job is
 * deleted once settled (delivered, out of attempts or past its
 * `deadlineAt`); the TTL index on `purgeAt` only drops what no queue was
 * left to settle.
 */
const outboundJobSchema = new Schema(
	{
		kind: { type: String, enum: ["inbox", "callback"], required: true },
		projectId: { type: Schema.Types.ObjectId, required: true },
		owner: { type: String, required: true },
		target: { type: Schema.Types.Mixed, required: true },
		query: { type: String, default: "" },
		method: { type: String, required: true },
		headers: { type: [headerSchema], default: [] },
		body: { type: Buffer, default: null },
		failure: { type: String, default: null },
		at: { type: Date, required: true },
		inboxId: { type: Schema.Types.ObjectId },
		lineId: { type: Schema.Types.ObjectId },
		resourceId: { type: Schema.Types.ObjectId },
		callbackId: { type: String },
		event: { type: String },
		attempts: { type: [attemptSchema], default: [] },
		charged: { type: Boolean, default: false },
		state: { type: String, enum: ["pending", "running"], default: "pending" },
		nextAt: { type: Date, required: true },
		lockedUntil: { type: Date, default: null },
		deadlineAt: { type: Date, required: true },
		purgeAt: { type: Date, required: true },
	},
	{ collection: "outbound_jobs", versionKey: false },
);
outboundJobSchema.index({ state: 1, nextAt: 1 });
outboundJobSchema.index({ projectId: 1, state: 1 });
outboundJobSchema.index({ owner: 1 });
outboundJobSchema.index({ deadlineAt: 1 });
outboundJobSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

outboundJobSchema.plugin(tenantScopePlugin);
export const OutboundJobModel = mongoose.model(
	"OutboundJob",
	outboundJobSchema,
);

/** Fields of a new job besides the delivery itself. */
export type NewJobRef = Pick<
	StoredOutboundJob,
	| "kind"
	| "projectId"
	| "owner"
	| "inboxId"
	| "lineId"
	| "resourceId"
	| "callbackId"
	| "event"
> & { readonly failure?: string };

/** The document of a job due now (its `_id` included). */
export function newJob(
	ref: NewJobRef,
	message: OutboundMessage,
	at: Date,
): StoredOutboundJob {
	const deadline = at.getTime() + JOB_TTL_MS;
	return {
		_id: new Types.ObjectId(),
		...ref,
		failure: ref.failure ?? null,
		target: message.target,
		query: message.query,
		method: message.method,
		headers: [...message.headers],
		body: message.body,
		at,
		attempts: [],
		charged: false,
		state: "pending",
		nextAt: at,
		lockedUntil: null,
		deadlineAt: new Date(deadline),
		purgeAt: new Date(deadline + JOB_PURGE_AFTER_MS),
	};
}
