import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { ElementRole } from "@localman/shared/access";
import type { ClientSession, Types } from "mongoose";
import { currentPlanOf } from "../billing/plan-guard.js";
import {
	findWorkspaceById,
	requireWorkspace,
} from "../workspaces/workspace-roles.js";
import { type ForkKind, ForkModel, type StoredFork } from "./fork-model.js";

/** 403 `PLAN_FEATURE_UNAVAILABLE` unless the caller's plan has forks. */
export async function requireForkPlan(sub: string): Promise<void> {
	if (limitsFor(await currentPlanOf(sub)).forkPrPublic) return;
	throw new OperationError(
		403,
		"PLAN_FEATURE_UNAVAILABLE",
		"Forks, merges and pull requests are part of the Pro plan",
	);
}

export function notAFork(): OperationError {
	return new OperationError(404, "FORK_NOT_FOUND", "This is not a fork");
}

export function sourceUnavailable(): OperationError {
	return new OperationError(
		404,
		"FORK_SOURCE_UNAVAILABLE",
		"The source of this fork no longer exists or you cannot open it",
	);
}

/** The fork link of `forkId` (a collection or environment), or `null`. */
export async function findLink(
	kind: ForkKind,
	forkId: Types.ObjectId,
	session?: ClientSession,
): Promise<StoredFork | null> {
	return ForkModel.findOne({ kind, forkId })
		.session(session ?? null)
		.lean<StoredFork>();
}

/** 404 `FORK_NOT_FOUND` when it is not a fork. */
export async function requireLink(
	kind: ForkKind,
	forkId: Types.ObjectId,
	session?: ClientSession,
): Promise<StoredFork> {
	const link = await findLink(kind, forkId, session);
	if (!link) throw notAFork();
	return link;
}

/** 409 `MERGE_CONFLICTS` while conflicts lack a choice. */
export function conflictsLeft(ids: readonly string[]): OperationError {
	return new OperationError(
		409,
		"MERGE_CONFLICTS",
		"Choose Keep Source or Keep Destination for every conflict first",
		{ unresolved: ids.length },
	);
}

/**
 * The workspace a fork goes to: one where the caller adds elements, and
 * their personal one only when they are a Viewer of the source (403
 * `FORK_TARGET_NOT_ALLOWED`).
 */
export async function requireForkTarget(
	sub: string,
	role: ElementRole,
	workspaceId: string,
) {
	// The specific reason first: a Viewer may lack addElements there too.
	const target = await findWorkspaceById(workspaceId);
	if (role === "viewer" && target && target.type !== "personal") {
		throw new OperationError(
			403,
			"FORK_TARGET_NOT_ALLOWED",
			"A Viewer forks into their personal workspace only",
		);
	}
	const { workspace } = await requireWorkspace(sub, "addElements", workspaceId);
	return workspace;
}
