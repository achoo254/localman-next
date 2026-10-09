import {
	type ApiRequestDraft,
	HISTORY_TTL_DAYS,
} from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";

/** How a request reached its target: the browser, the proxy, a tunnel. */
export const HISTORY_ROUTES = ["direct", "proxy", "tunnel"] as const;
export type HistoryRoute = (typeof HISTORY_ROUTES)[number];

const HISTORY_TTL_SECONDS = HISTORY_TTL_DAYS * 24 * 60 * 60;

/**
 * One sent request of the API client (`client_history`), per user.
 *
 * `draft` is the request as the user wrote it, `{{var}}` placeholders
 * left as they are: the browser never sends interpolated values here, so
 * a secret variable does not reach the server through history. Of the
 * response only a summary is kept; its headers and body may carry
 * personal data or tokens and are never stored. `bodyOmitted`: the raw
 * body was dropped because the entry would exceed its size cap.
 */
const historySchema = new Schema(
	{
		userSub: { type: String, required: true },
		draft: { type: Schema.Types.Mixed, required: true },
		bodyOmitted: { type: Boolean, required: true, default: false },
		response: {
			status: { type: Number, required: true },
			ms: { type: Number, required: true },
			size: { type: Number, required: true },
			route: { type: String, enum: [...HISTORY_ROUTES], required: true },
			/** Origin and path of the last hop; query and fragment dropped. */
			finalUrl: { type: String },
		},
		createdAt: {
			type: Date,
			required: true,
			default: Date.now,
			expires: HISTORY_TTL_SECONDS,
		},
	},
	{ collection: "client_history", versionKey: false, minimize: false },
);
// Newest first per user (cursor = _id), and the per-user cap.
historySchema.index({ userSub: 1, _id: -1 });

export const HistoryModel = mongoose.model("ClientHistory", historySchema);

/** Lean record; `draft` passed `apiRequestDraftSchema` when written. */
export interface StoredHistoryEntry {
	_id: Types.ObjectId;
	userSub: string;
	draft: ApiRequestDraft;
	bodyOmitted: boolean;
	response: {
		status: number;
		ms: number;
		size: number;
		route: HistoryRoute;
		finalUrl?: string | null;
	};
	createdAt: Date;
}
