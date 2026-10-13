import type { HeaderEntry } from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** Who answered a logged request (`inbox`, `callback`: outbound deliveries). */
export const REQUEST_LOG_SOURCES = [
	"mock",
	"upstream",
	"rule",
	"inbox",
	"callback",
] as const;
export type RequestLogSource = (typeof REQUEST_LOG_SOURCES)[number];

/** A logged body: UTF-8 text when it decodes, else base64. */
export interface StoredLogBody {
	readonly body: string;
	readonly bodyEncoding: "utf8" | "base64";
	/** Bytes of the whole body, before the 64 KB cut. */
	readonly size: number;
	readonly truncated: boolean;
}

/** One side of a logged exchange; masked headers read `[redacted]`. */
export interface StoredLogMessage extends StoredLogBody {
	readonly headers: HeaderEntry[];
}

/** Mock callback events (a record created, updated or deleted). */
export const CALLBACK_EVENTS = ["create", "update", "delete"] as const;
export type CallbackEvent = (typeof CALLBACK_EVENTS)[number];

/**
 * One delivery attempt of an inbox forward or a mock callback: the status
 * when an answer came, else why none came (`no_tunnel`, `connect`,
 * `timeout`, `dns`, `blocked`, `busy`, `body_too_large`).
 */
export interface StoredAttempt {
	readonly at: Date;
	readonly status?: number;
	readonly error?: string;
	readonly ms: number;
}

/** A `request_logs` document. */
export interface StoredRequestLog {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly at: Date;
	readonly method: string;
	/** Percent-encoded path below the secret (prefix included). */
	readonly path: string;
	/** Raw query string without `?`; empty when none. */
	readonly query: string;
	readonly status: number;
	readonly ms: number;
	readonly source: RequestLogSource;
	readonly request: StoredLogMessage;
	readonly response: StoredLogMessage;
	/** TTL: `at` plus the owner plan's `requestLogDays` when written. */
	readonly expiresAt: Date;
	/** Inbox lines: the inbox name. */
	readonly inbox?: string;
	/** Callback lines: the record event that fired it. */
	readonly event?: CallbackEvent;
	/** Where an inbox forwards (`tunnel:<port><path>`) or a callback went. */
	readonly target?: string;
	/** Delivery attempts of the forward or callback, oldest first. */
	readonly attempts?: StoredAttempt[];
}

const headerSchema = new Schema(
	{ name: { type: String }, value: { type: String } },
	{ _id: false },
);

const messageSchema = new Schema(
	{
		headers: { type: [headerSchema], default: [] },
		body: { type: String, default: "" },
		bodyEncoding: { type: String, enum: ["utf8", "base64"], default: "utf8" },
		size: { type: Number, default: 0 },
		truncated: { type: Boolean, default: false },
	},
	{ _id: false },
);

/**
 * Live log of a project's mock runtime traffic, written in batches by
 * `RequestLogService`. Each line expires on its own `expiresAt`, fixed
 * from the owner's plan when it was written (a later upgrade does not
 * extend older lines).
 */
const attemptSchema = new Schema(
	{
		at: { type: Date, required: true },
		status: { type: Number },
		error: { type: String },
		ms: { type: Number, required: true },
	},
	{ _id: false },
);

const requestLogSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		at: { type: Date, required: true },
		method: { type: String, required: true },
		path: { type: String, required: true },
		query: { type: String, default: "" },
		status: { type: Number, required: true },
		ms: { type: Number, required: true },
		source: { type: String, enum: [...REQUEST_LOG_SOURCES], required: true },
		request: { type: messageSchema, required: true },
		response: { type: messageSchema, required: true },
		expiresAt: { type: Date, required: true },
		inbox: { type: String },
		event: { type: String, enum: [...CALLBACK_EVENTS] },
		target: { type: String },
		attempts: { type: [attemptSchema], default: undefined },
	},
	{ collection: "request_logs", versionKey: false },
);
/**
 * Newest first per project; the cursor of a page is the last `_id` (an
 * ObjectId made when the line was, so `_id` order is time order and no
 * `at` index is needed). Also the per-project trim's skip.
 */
requestLogSchema.index({ projectId: 1, _id: -1 });
// The list's source, method and status filters, still newest first.
requestLogSchema.index({ projectId: 1, source: 1, _id: -1 });
requestLogSchema.index({ projectId: 1, method: 1, _id: -1 });
requestLogSchema.index({ projectId: 1, status: 1, _id: -1 });
/** Request counts of a project's inboxes (inbox lines only). */
requestLogSchema.index(
	{ projectId: 1, inbox: 1 },
	{ partialFilterExpression: { source: "inbox" } },
);
requestLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

requestLogSchema.plugin(tenantScopePlugin);
export const RequestLogModel = mongoose.model("RequestLog", requestLogSchema);
