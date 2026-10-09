import { OperationError } from "@localman/operations";
import type { ProInterestSubmission } from "@localman/shared";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { UserModel } from "../users/user-model.js";
import { FeedbackModel, SUBMISSION_HISTORY_MAX } from "./feedback-model.js";

/**
 * `created`: a new entry. `updated`: the sender owns the entry and their
 * answers replaced it. `recorded`: the entry belongs to someone else, so
 * the submission was only added to its history.
 */
export type ProInterestSaveOutcome = "created" | "updated" | "recorded";

const MAX_ATTEMPTS = 3;

/** Whether the signed-in sender verified this very email at the IdP. */
async function emailMatchesAccount(
	userSub: string | null,
	email: string,
): Promise<boolean> {
	if (userSub === null) return false;
	const user = await UserModel.findOne({ sub: userSub })
		.select("email emailVerified")
		.lean<{ email?: string | null; emailVerified?: boolean }>();
	return (
		user?.emailVerified === true && user.email?.trim().toLowerCase() === email
	);
}

/**
 * Who may replace an existing entry's answers: the account it is linked
 * to; or, for an entry without account, another guest (nobody can tell
 * guests apart) or a signed-in user who verified that email, who then
 * claims it. A linked account is never replaced.
 */
function mayReplace(
	linkedSub: string | null,
	senderSub: string | null,
	matches: boolean,
): boolean {
	if (linkedSub !== null) return senderSub === linkedSub;
	return senderSub === null || matches;
}

/**
 * Stores a submission, merged by email. Every submission is appended to
 * the bounded history so the owner sees it; the entry's answers change
 * only when `mayReplace` allows. Each update is conditioned on the linked
 * account it was decided for, so a concurrent claim is re-decided.
 */
export async function saveProInterest(
	entry: ProInterestSubmission,
	userSub: string | null,
): Promise<ProInterestSaveOutcome> {
	const now = new Date();
	const matches = await emailMatchesAccount(userSub, entry.email);
	const answers = {
		name: entry.name,
		needs: entry.needs,
		teamSize: entry.teamSize,
		source: entry.source,
		...(entry.priceHint ? { priceHint: entry.priceHint } : {}),
		...(entry.note ? { note: entry.note } : {}),
	};
	const snapshot = (applied: boolean) => ({
		at: now,
		...(userSub ? { userSub } : {}),
		...answers,
		emailMatchesAccount: matches,
		applied,
	});
	const pushHistory = (applied: boolean) => ({
		submissions: {
			$each: [snapshot(applied)],
			$slice: -SUBMISSION_HISTORY_MAX,
		},
	});

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const existing = await FeedbackModel.findOne({
			type: "pro_interest",
			email: entry.email,
		})
			.select("userSub")
			.lean<{ _id: unknown; userSub?: string | null }>();
		if (!existing) {
			try {
				await FeedbackModel.create({
					type: "pro_interest",
					email: entry.email,
					...answers,
					...(userSub ? { userSub } : {}),
					consentAt: now,
					emailMatchesAccount: matches,
					submissions: [snapshot(true)],
				});
				return "created";
			} catch (error) {
				// Another first submission of this email won: decide again.
				if (!isDuplicateKeyError(error)) throw error;
				continue;
			}
		}
		const linkedSub = existing.userSub ?? null;
		const replace = mayReplace(linkedSub, userSub, matches);
		const unset: Record<string, 1> = {};
		if (!entry.priceHint) unset.priceHint = 1;
		if (!entry.note) unset.note = 1;
		const update = replace
			? {
					$set: {
						...answers,
						consentAt: now,
						emailMatchesAccount: matches,
						...(userSub ? { userSub } : {}),
					},
					...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
					$push: pushHistory(true),
				}
			: { $push: pushHistory(false) };
		const result = await FeedbackModel.updateOne(
			{ _id: existing._id, userSub: linkedSub },
			update,
		);
		if (result.matchedCount === 1) return replace ? "updated" : "recorded";
	}
	throw new OperationError(409, "CONFLICT", "Submission conflicted; try again");
}
