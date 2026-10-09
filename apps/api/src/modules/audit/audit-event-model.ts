import mongoose, { Schema } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";

/** The IdP keeps delivered events 30 days; so does Localman. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

/**
 * Audit events received from the IdP, keyed by `jti` so a redelivered
 * event (lost response, retry) is recognised and not applied twice.
 * Holds no secret: the IdP never puts one in an event.
 */
const auditEventSchema = new Schema(
	{
		_id: { type: String, required: true },
		sub: { type: String, required: true, index: true },
		type: { type: String, required: true },
		occurredAt: { type: Date, required: true },
		data: { type: Schema.Types.Mixed, required: true },
		receivedAt: {
			type: Date,
			required: true,
			default: Date.now,
			expires: RETENTION_SECONDS,
		},
	},
	{ collection: "audit_events", versionKey: false, minimize: false },
);

export const AuditEventModel = mongoose.model("AuditEvent", auditEventSchema);

export async function wasAuditEventReceived(jti: string): Promise<boolean> {
	return (await AuditEventModel.exists({ _id: jti })) !== null;
}

/** Records an applied event; `false` when a concurrent delivery won. */
export async function recordAuditEvent(event: {
	readonly jti: string;
	readonly sub: string;
	readonly type: string;
	readonly occurredAt: Date;
	readonly data: Readonly<Record<string, unknown>>;
}): Promise<boolean> {
	try {
		await AuditEventModel.create({ _id: event.jti, ...event });
		return true;
	} catch (error) {
		if (isDuplicateKeyError(error)) return false;
		throw error;
	}
}
