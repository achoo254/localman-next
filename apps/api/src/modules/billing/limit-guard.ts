import { OperationError } from "@localman/operations";
import { LIMITS } from "@localman/shared";

/** Quotas enforced by count; extend when another resource gets a cap. */
export type CountedLimit =
	| "projects"
	| "resources"
	| "members"
	| "teamWorkspaces";

/**
 * 403 with the numbers the web shows in plain words. The code keeps its
 * historical name `PLAN_LIMIT_REACHED`: shipped clients match on it.
 */
export class LimitReachedError extends OperationError {
	constructor(limit: CountedLimit, max: number, used: number) {
		super(
			403,
			"PLAN_LIMIT_REACHED",
			`Limit reached: at most ${max} ${limit} on this account`,
			{ limit, max, used },
		);
		this.name = "LimitReachedError";
	}
}

/** `Infinity` does not survive JSON: an uncapped count becomes `null`. */
export function toJsonLimit(max: number | null): number | null {
	return max === null || Number.isFinite(max) ? max : null;
}

/**
 * Throws `PLAN_LIMIT_REACHED` when the owner already uses every project.
 * Only projects the user owns count, never shared ones.
 */
export function assertProjectQuota(ownedProjects: number): void {
	const max = LIMITS.projects;
	if (ownedProjects >= max) {
		throw new LimitReachedError("projects", max, ownedProjects);
	}
}

/**
 * Throws `PLAN_LIMIT_REACHED` when adding `adding` resources to the
 * `ownedResources` the owner already has would pass the limit. The limit
 * counts every resource of every project the user owns (an account-wide
 * total like `projects`), never resources of projects shared with them.
 */
export function assertResourceQuota(ownedResources: number, adding = 1): void {
	const max = LIMITS.resources;
	if (ownedResources + adding > max) {
		throw new LimitReachedError("resources", max, ownedResources);
	}
}
