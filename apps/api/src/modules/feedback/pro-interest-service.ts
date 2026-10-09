import type { ProInterestSubmission } from "@localman/shared";
import { alertOwnerThrottled } from "./owner-alert-throttle.js";
import { proInterestAlertText } from "./pro-interest-alert.js";
import { saveProInterest } from "./pro-interest-store.js";

/** Stores the submission, then alerts the owner (throttled, in background). */
export async function recordProInterest(
	entry: ProInterestSubmission,
	userSub: string | null,
): Promise<void> {
	const outcome = await saveProInterest(entry, userSub);
	await alertOwnerThrottled(
		"feedback.pro_interest",
		proInterestAlertText(entry, outcome),
	);
}
