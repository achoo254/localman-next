import { TRIAL_EXTENSION_STATUSES, TRIAL_STATUSES } from "@localman/shared";
import { z } from "zod";
import {
	type StoredTrialExtension,
	latestExtensionOf,
} from "./trial-extension-model.js";
import { type TrialUser, trialStateOf } from "./trial-state.js";

/** `trial` of `GET /users/me`. Dates are ISO strings. */
export const trialSchema = z.object({
	status: z.enum(TRIAL_STATUSES),
	startedAt: z.string().nullable(),
	/** End of the Asia/Saigon day the trial (or its extension) ends. */
	endsAt: z.string().nullable(),
	/** The latest extension request, whatever its outcome. */
	extensionRequest: z
		.object({
			status: z.enum(TRIAL_EXTENSION_STATUSES),
			requestedAt: z.string(),
			decidedAt: z.string().nullable(),
		})
		.nullable(),
});

export type TrialView = z.output<typeof trialSchema>;

export function toTrialView(
	user: TrialUser,
	latest: StoredTrialExtension | null,
	now: Date,
): TrialView {
	const state = trialStateOf(user, now);
	return {
		status: state.status,
		startedAt: state.startedAt?.toISOString() ?? null,
		endsAt: state.endsAt?.toISOString() ?? null,
		extensionRequest: latest
			? {
					status: latest.status,
					requestedAt: latest.requestedAt.toISOString(),
					decidedAt: latest.decidedAt?.toISOString() ?? null,
				}
			: null,
	};
}

/** The trial view of a user, with their latest extension request. */
export async function loadTrialView(
	sub: string,
	user: TrialUser,
	now: Date,
): Promise<TrialView> {
	return toTrialView(user, await latestExtensionOf(sub), now);
}
