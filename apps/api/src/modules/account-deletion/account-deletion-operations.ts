import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSession } from "../../http/require-auth.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { signedOut } from "../users/me-view.js";
import { UserModel } from "../users/user-model.js";
import {
	type AccountDeletionSummary,
	deleteAccount,
	previewAccountDeletion,
} from "./account-deletion-service.js";

/** Deletions per account and hour: a retry after a failure, not a loop. */
const DELETION_RATE_LIMIT = { max: 5, windowMs: 60 * 60_000 } as const;

const summary = z.object({
	ownedProjects: z.number().int(),
	sharedProjects: z.number().int(),
	projectMembers: z.number().int(),
	workspacesDeleted: z.number().int(),
	workspacesLeft: z.number().int(),
	collectionsDeleted: z.number().int(),
	blockedWorkspaces: z.array(z.object({ id: z.string(), name: z.string() })),
});

function toOutput(
	result: AccountDeletionSummary,
	deleted: boolean,
): z.infer<typeof summary> & { dryRun: boolean; deleted: boolean } {
	return {
		...result,
		blockedWorkspaces: [...result.blockedWorkspaces],
		dryRun: !deleted,
		deleted,
	};
}

async function usernameOf(sub: string): Promise<string> {
	const user = await UserModel.findOne({ sub }, { username: 1 }).lean<{
		username: string;
	}>();
	if (!user) throw signedOut();
	return user.username;
}

export const deleteMyAccount = defineOperation({
	id: "users.deleteAccount",
	method: "DELETE",
	path: "/users/me",
	summary: "Delete the signed-in user's Localman account",
	description:
		"Deletes the account's Localman data for good: owned mock projects with everything in them (`sharedProjects` of them have other members, `projectMembers` people, who lose access), the personal workspace and team workspaces with no other member (their collections and environments), the API client history, drafts and settings, notifications, linked Tunelo machines (revoked at Tunelo) and every session. In team workspaces it keeps, the account leaves and its name is removed from what it wrote (comments, changelog, collections). The sign-in account at the identity provider is not deleted. Call with dryRun first: it returns the counts and `blockedWorkspaces`, team workspaces where the account is the only Admin of other members; while any is listed the deletion answers 409 ACCOUNT_DELETION_BLOCKED (make another member Admin first). The deletion needs `confirm` equal to the account's username (400 CONFIRMATION_MISMATCH otherwise) and a browser session. 429 RATE_LIMITED past 5 deletions an hour.",
	input: z.object({ confirm: z.string().max(200).optional() }),
	output: summary.extend({ dryRun: z.boolean(), deleted: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "users",
	mcp: {
		exempt:
			"Deleting the account is the person's own decision, confirmed in the browser; an agent never makes it",
	},
	dryRun: true,
	handler: async (ctx, input) => {
		const { sub } = requireSession(ctx);
		const username = await usernameOf(sub);
		if (ctx.dryRun) {
			const preview = await previewAccountDeletion(sub);
			return toOutput(preview, false);
		}
		if (input.confirm?.trim() !== username) {
			throw new OperationError(
				400,
				"CONFIRMATION_MISMATCH",
				"Type your username to confirm the deletion",
			);
		}
		const allowed = await takeRateLimitSlot(
			"account-deletion:user",
			sub,
			DELETION_RATE_LIMIT,
		);
		if (!allowed) {
			throw new OperationError(
				429,
				"RATE_LIMITED",
				"Too many deletion attempts; wait an hour and try again",
			);
		}
		return toOutput(await deleteAccount(sub), true);
	},
});
