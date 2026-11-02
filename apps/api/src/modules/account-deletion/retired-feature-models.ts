import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * Rows left by features removed when every account got the same limits
 * (docs/decisions/0011-one-level-for-everyone.md): Pro trial extension
 * requests and Pro-interest form entries. Nothing writes them any more and
 * no page reads them; they stay only so that deleting an account still
 * erases the person's data in them. Only the fields account deletion
 * filters or rewrites are declared.
 */

const trialExtensionSchema = new Schema(
	{
		userSub: { type: String, required: true },
		/** Owner `sub` who approved or declined the request. */
		decidedBy: { type: String },
	},
	{ collection: "trial_extension_requests", versionKey: false },
);
trialExtensionSchema.plugin(tenantScopePlugin);
export const TrialExtensionModel = mongoose.model(
	"TrialExtension",
	trialExtensionSchema,
);

/**
 * Pro-interest entries share the `feedback` collection with contact
 * messages (`ContactMessageModel`); every query filters on
 * `type: "pro_interest"`.
 */
const feedbackSchema = new Schema(
	{
		type: { type: String, enum: ["pro_interest"], required: true },
		email: { type: String, required: true },
		/** Set when the sender was signed in. */
		userSub: { type: String },
		/** Earlier submissions; each may name another signed-in sender. */
		submissions: {
			type: [new Schema({ userSub: { type: String } }, { _id: false })],
			default: undefined,
		},
	},
	{ collection: "feedback", timestamps: true, versionKey: false },
);
feedbackSchema.plugin(tenantScopePlugin);
export const FeedbackModel = mongoose.model("Feedback", feedbackSchema);
