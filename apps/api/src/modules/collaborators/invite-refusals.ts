import { OperationError } from "@localman/operations";
import { PlanLimitError } from "../billing/plan-guard.js";
import type { IneligibleReason, ResolvedToken } from "./invite-eligibility.js";
import { memberSeats } from "./member-seats.js";

export const changedMeanwhile = (): OperationError =>
	new OperationError(
		409,
		"CONFLICT",
		"The invite link changed meanwhile; open it again",
	);

export const removedByOwner = (): OperationError =>
	new OperationError(
		403,
		"REMOVED_BY_OWNER",
		"The owner removed you from this project; ask them for a new invitation",
	);

/** The error an accept answers for a reason the caller is not eligible. */
export async function refusal(
	reason: Exclude<IneligibleReason, "ALREADY_MEMBER">,
	token: ResolvedToken,
): Promise<OperationError> {
	if (reason === "MEMBER_LIMIT") {
		const seats = await memberSeats(token.project);
		return new PlanLimitError("members", seats.max, seats.used);
	}
	if (reason === "REMOVED_BY_OWNER") return removedByOwner();
	if (reason === "EMAIL_NOT_VERIFIED") {
		return new OperationError(
			403,
			"EMAIL_NOT_VERIFIED",
			"Your email matches the invitation but is not verified; link Google or GitHub with this email, or sign in with the invited account",
		);
	}
	return new OperationError(
		403,
		"NOT_INVITEE",
		"This invitation is for another account",
	);
}
