import {
	PRO_INTEREST_NEEDS,
	PRO_INTEREST_TEAM_SIZES,
	type ProInterestNeed,
	type ProInterestTeamSize,
} from "@localman/shared";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * Types this model stores. Contact messages (`type: "contact"`) share the
 * collection through `ContactMessageModel` in contact-message-model.ts.
 */
export const FEEDBACK_TYPES = ["pro_interest"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Most recent submissions kept per entry, newest last. */
export const SUBMISSION_HISTORY_MAX = 20;

/** One submission as received, kept even when it did not change the entry. */
const submissionSchema = new Schema(
	{
		at: { type: Date, required: true },
		userSub: { type: String },
		name: { type: String, required: true },
		needs: { type: [String], default: undefined },
		teamSize: { type: String },
		priceHint: { type: String },
		note: { type: String },
		source: { type: String, required: true },
		emailMatchesAccount: { type: Boolean, required: true },
		/** False when the entry belongs to someone else and was not changed. */
		applied: { type: Boolean, required: true },
	},
	{ _id: false },
);

/**
 * Messages people leave for the Localman owner. Fields beyond `type` and
 * the timestamps belong to one type; a Pro-interest entry is keyed by its
 * normalized email, so a repeated submission updates the same document.
 */
const feedbackSchema = new Schema(
	{
		type: { type: String, enum: FEEDBACK_TYPES, required: true },
		/** Trimmed, lower-cased. */
		email: { type: String, required: true },
		/** Set when the sender was signed in. */
		userSub: { type: String },
		name: { type: String, required: true },
		needs: { type: [String], enum: PRO_INTEREST_NEEDS, default: undefined },
		teamSize: { type: String, enum: PRO_INTEREST_TEAM_SIZES },
		priceHint: { type: String },
		note: { type: String },
		/** Where the form was opened (landing, plan_limit_projects…). */
		source: { type: String, required: true },
		/** When the person last agreed to be contacted about Pro. */
		consentAt: { type: Date, required: true },
		/** Set by the owner from the admin page. */
		contactedAt: { type: Date },
		/**
		 * The signed-in sender of the current answers had verified this email
		 * at the IdP: the address really belongs to them.
		 */
		emailMatchesAccount: { type: Boolean, default: false },
		/** Last `SUBMISSION_HISTORY_MAX` submissions, newest last. */
		submissions: { type: [submissionSchema], default: undefined },
	},
	{ collection: "feedback", timestamps: true, versionKey: false },
);
feedbackSchema.index(
	{ type: 1, email: 1 },
	{ unique: true, partialFilterExpression: { type: "pro_interest" } },
);
feedbackSchema.index({ type: 1, createdAt: -1 });

feedbackSchema.plugin(tenantScopePlugin);
export const FeedbackModel = mongoose.model("Feedback", feedbackSchema);

export interface StoredSubmission {
	readonly at: Date;
	readonly userSub?: string | null;
	readonly name: string;
	readonly needs: ProInterestNeed[];
	readonly teamSize: ProInterestTeamSize;
	readonly priceHint?: string | null;
	readonly note?: string | null;
	readonly source: string;
	readonly emailMatchesAccount: boolean;
	readonly applied: boolean;
}

export interface StoredProInterest {
	readonly _id: Types.ObjectId;
	readonly email: string;
	readonly userSub?: string | null;
	readonly name: string;
	readonly needs: ProInterestNeed[];
	readonly teamSize: ProInterestTeamSize;
	readonly priceHint?: string | null;
	readonly note?: string | null;
	readonly source: string;
	readonly consentAt: Date;
	readonly contactedAt?: Date | null;
	readonly emailMatchesAccount?: boolean | null;
	readonly submissions?: StoredSubmission[] | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
