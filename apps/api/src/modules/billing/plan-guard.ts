import { OperationError } from "@localman/operations";
import { type PlanId, limitsFor } from "@localman/shared";
import { UserModel } from "../users/user-model.js";

/** Quotas enforced by count; extend when another resource gets a cap. */
export type CountedLimit = "projects" | "resources" | "members";

/** 403 `PLAN_LIMIT_REACHED` with the numbers the upgrade dialog shows. */
export class PlanLimitError extends OperationError {
	constructor(limit: CountedLimit, max: number, used: number) {
		super(
			403,
			"PLAN_LIMIT_REACHED",
			`Your plan allows ${max} ${limit}; upgrade to create more`,
			{ limit, max, used },
		);
		this.name = "PlanLimitError";
	}
}

export interface StoredPlan {
	readonly plan: PlanId;
	readonly planExpiresAt: Date | null;
}

/** A Pro plan past its expiry is Free; Pro without expiry never lapses. */
export function effectivePlan(
	stored: StoredPlan,
	now: Date = new Date(),
): PlanId {
	if (stored.plan !== "pro") return "free";
	const expiresAt = stored.planExpiresAt;
	return expiresAt === null || expiresAt > now ? "pro" : "free";
}

/** The stored plan of a user; an unknown user counts as Free. */
export async function storedPlanOf(sub: string): Promise<StoredPlan> {
	const user = await UserModel.findOne({ sub })
		.select("plan planExpiresAt")
		.lean<{ plan?: PlanId; planExpiresAt?: Date | null }>();
	return {
		plan: user?.plan ?? "free",
		planExpiresAt: user?.planExpiresAt ?? null,
	};
}

/** The plan whose limits apply to the user right now. */
export async function currentPlanOf(sub: string): Promise<PlanId> {
	return effectivePlan(await storedPlanOf(sub));
}

/** `Infinity` does not survive JSON: an uncapped count becomes `null`. */
export function toJsonLimit(max: number | null): number | null {
	return max === null || Number.isFinite(max) ? max : null;
}

/**
 * Throws `PLAN_LIMIT_REACHED` when the owner already uses every project of
 * the plan. Only projects the user owns count, never shared ones.
 */
export function assertProjectQuota(plan: PlanId, ownedProjects: number): void {
	const max = limitsFor(plan).projects;
	if (ownedProjects >= max) {
		throw new PlanLimitError("projects", max, ownedProjects);
	}
}

/**
 * Throws `PLAN_LIMIT_REACHED` when adding `adding` resources to the
 * `ownedResources` the owner already has would pass the plan. The limit
 * counts every resource of every project the user owns (an account-wide
 * total like `projects`; per-project limits are named `…Per…` in
 * plan-limits), never resources of projects shared with them.
 */
export function assertResourceQuota(
	plan: PlanId,
	ownedResources: number,
	adding = 1,
): void {
	const max = limitsFor(plan).resources;
	if (ownedResources + adding > max) {
		throw new PlanLimitError("resources", max, ownedResources);
	}
}
