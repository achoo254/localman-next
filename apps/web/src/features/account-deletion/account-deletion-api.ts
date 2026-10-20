import { ApiError, apiRequest, withDryRun } from "../../lib/api-client";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
} from "../../lib/json-guards";

/** A team workspace that keeps the account from being deleted. */
export interface BlockingWorkspace {
	id: string;
	name: string;
}

/** What deleting the account does (`DELETE /api/v1/users/me`). */
export interface AccountDeletionSummary {
	ownedProjects: number;
	/** Owned projects other people are members of. */
	sharedProjects: number;
	/** People who are members of those projects and lose them. */
	projectMembers: number;
	workspacesDeleted: number;
	workspacesLeft: number;
	collectionsDeleted: number;
	/** Team workspaces where the account is the only Admin of other members. */
	blockedWorkspaces: BlockingWorkspace[];
}

const PATH = "/api/v1/users/me";

function parseSummary(value: unknown): AccountDeletionSummary {
	const data = expectRecord(value, "account deletion");
	return {
		ownedProjects: expectNumber(data, "ownedProjects"),
		sharedProjects: expectNumber(data, "sharedProjects"),
		projectMembers: expectNumber(data, "projectMembers"),
		workspacesDeleted: expectNumber(data, "workspacesDeleted"),
		workspacesLeft: expectNumber(data, "workspacesLeft"),
		collectionsDeleted: expectNumber(data, "collectionsDeleted"),
		blockedWorkspaces: expectArray(data, "blockedWorkspaces").map((item) => {
			const workspace = expectRecord(item, "blocked workspace");
			return {
				id: expectString(workspace, "id"),
				name: expectString(workspace, "name"),
			};
		}),
	};
}

/** The dry run: counts and blockers; writes nothing. */
export async function previewAccountDeletion(): Promise<AccountDeletionSummary> {
	return parseSummary(
		await apiRequest(withDryRun(PATH, true), { method: "DELETE", body: {} }),
	);
}

/**
 * Whether the deletion went through although its answer was lost: a
 * long deletion can outlive the proxy's timeout (network error or 5xx),
 * yet the account is gone once the session no longer works (401).
 */
async function deletedAnyway(error: unknown): Promise<boolean> {
	if (!(error instanceof ApiError)) return false;
	if (error.status !== 0 && error.status < 500) return false;
	try {
		await apiRequest("/api/v1/users/me", { redirectOnUnauthorized: false });
		return false;
	} catch (check) {
		return check instanceof ApiError && check.status === 401;
	}
}

/**
 * Deletes the account; `confirm` is the username typed back. Resolves
 * also when the answer was lost but the account is gone.
 */
export async function deleteAccount(confirm: string): Promise<void> {
	try {
		await apiRequest(PATH, { method: "DELETE", body: { confirm } });
	} catch (error) {
		if (!(await deletedAnyway(error))) throw error;
	}
}
