import type { ApiRequestDraft } from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * An open tab of the API client with its unsaved request
 * (`client_drafts`), one record per tab and user. `tabId` is chosen by the
 * browser; `order` is the tab's position in the tab bar. Like history,
 * `draft` keeps `{{var}}` placeholders and only the name of a picked file.
 */
const draftSchema = new Schema(
	{
		userSub: { type: String, required: true },
		tabId: { type: String, required: true },
		order: { type: Number, required: true },
		draft: { type: Schema.Types.Mixed, required: true },
	},
	{
		collection: "client_drafts",
		timestamps: true,
		versionKey: false,
		minimize: false,
	},
);
draftSchema.index({ userSub: 1, tabId: 1 }, { unique: true });
draftSchema.index({ userSub: 1, order: 1 });

export const DraftModel = mongoose.model("ClientDraft", draftSchema);

/** Lean record; `draft` passed `apiRequestDraftSchema` when written. */
export interface StoredDraft {
	_id: Types.ObjectId;
	userSub: string;
	tabId: string;
	order: number;
	draft: ApiRequestDraft;
	updatedAt: Date;
}
