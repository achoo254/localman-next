import {
	TRIAL_EXTENSION_STATUSES,
	type TrialExtensionStatus,
} from "@localman/shared";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * A user's request to extend their Pro trial, decided by an owner on the
 * admin page. `reason` is the user's own text: shown to owners only,
 * never logged nor sent in alerts.
 */
const trialExtensionSchema = new Schema(
	{
		userSub: { type: String, required: true },
		reason: { type: String, required: true },
		status: {
			type: String,
			enum: [...TRIAL_EXTENSION_STATUSES],
			required: true,
			default: "pending",
		},
		requestedAt: { type: Date, required: true },
		decidedAt: { type: Date },
		/** Owner `sub` who approved or declined. */
		decidedBy: { type: String },
	},
	{ collection: "trial_extension_requests", versionKey: false },
);

// One pending request per user: a second insert fails on this index, so
// two requests sent at once cannot both be stored.
trialExtensionSchema.index(
	{ userSub: 1, status: 1 },
	{ unique: true, partialFilterExpression: { status: "pending" } },
);
// The user's latest request (`GET /users/me`).
trialExtensionSchema.index({ userSub: 1, requestedAt: -1 });
// The admin list: pending (or every) request, newest first.
trialExtensionSchema.index({ status: 1, requestedAt: -1 });

export const TrialExtensionModel = mongoose.model(
	"TrialExtension",
	trialExtensionSchema,
);

export interface StoredTrialExtension {
	_id: Types.ObjectId;
	userSub: string;
	reason: string;
	status: TrialExtensionStatus;
	requestedAt: Date;
	decidedAt?: Date | null;
	decidedBy?: string | null;
}

/** The user's latest request, or `null` when they never asked. */
export function latestExtensionOf(
	userSub: string,
): Promise<StoredTrialExtension | null> {
	return TrialExtensionModel.findOne({ userSub })
		.sort({ requestedAt: -1, _id: -1 })
		.lean<StoredTrialExtension>()
		.exec();
}
