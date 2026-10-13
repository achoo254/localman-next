import { parseArgs } from "node:util";
import type { PlanId } from "@localman/shared";
import { TENANT_OPTION, tenantIdArg } from "../../tenancy/tenant-arg.js";
import { endOfSaigonDay } from "../../time/saigon-time.js";
import { UserModel } from "../users/user-model.js";

export const SET_USER_PLAN_USAGE =
	"Usage: set-user-plan [--tenant <id>] (--sub <sub> | --username <name>) --plan free|pro [--expires YYYY-MM-DD [--force]]";

export class UsageError extends Error {
	constructor(message: string) {
		super(`${message}\n${SET_USER_PLAN_USAGE}`);
		this.name = "UsageError";
	}
}

export interface SetUserPlanArgs {
	/** Tenant whose user it is (`--tenant`, primary by default). */
	readonly tenantId: string;
	readonly user: { readonly sub: string } | { readonly username: string };
	readonly plan: PlanId;
	/** End of the given day in Asia/Saigon; `null` for no expiry. */
	readonly expiresAt: Date | null;
}

export interface SetUserPlanResult {
	readonly sub: string;
	readonly username: string;
	readonly plan: PlanId;
	readonly planExpiresAt: string | null;
}

/**
 * Parses and validates the CLI arguments; throws `UsageError`. An expiry
 * already past (a typo would silently grant nothing) needs `--force`.
 */
export function parseSetUserPlanArgs(
	argv: readonly string[],
	now: Date = new Date(),
): SetUserPlanArgs {
	let values: Record<string, string | boolean | undefined>;
	try {
		({ values } = parseArgs({
			args: [...argv],
			options: {
				sub: { type: "string" },
				username: { type: "string" },
				plan: { type: "string" },
				expires: { type: "string" },
				force: { type: "boolean" },
				...TENANT_OPTION,
			},
			strict: true,
		}));
	} catch (error) {
		throw new UsageError(error instanceof Error ? error.message : "bad args");
	}
	const text = (key: string): string | undefined => {
		const value = values[key];
		return typeof value === "string" ? value : undefined;
	};
	const sub = text("sub");
	const username = text("username");
	const plan = text("plan");
	const expires = text("expires");
	if (Boolean(sub) === Boolean(username)) {
		throw new UsageError("Give exactly one of --sub or --username");
	}
	if (plan !== "free" && plan !== "pro") {
		throw new UsageError("--plan must be free or pro");
	}
	if (plan === "free" && expires !== undefined) {
		throw new UsageError("--expires only applies to --plan pro");
	}
	let expiresAt: Date | null = null;
	if (expires !== undefined) {
		expiresAt = endOfSaigonDay(expires);
		if (!expiresAt) throw new UsageError("--expires must be YYYY-MM-DD");
		if (expiresAt <= now && values.force !== true) {
			throw new UsageError(
				"--expires is already past; add --force to set it anyway",
			);
		}
	}
	let tenantId: string;
	try {
		tenantId = tenantIdArg(text("tenant"));
	} catch (error) {
		throw new UsageError(error instanceof Error ? error.message : "bad tenant");
	}
	return {
		tenantId,
		user: sub ? { sub } : { username: username ?? "" },
		plan,
		expiresAt,
	};
}

/**
 * Sets the plan of one existing user. Usernames are not unique, so an
 * ambiguous username is refused instead of picking one.
 */
export async function setUserPlan(
	args: SetUserPlanArgs,
): Promise<SetUserPlanResult> {
	const matches = await UserModel.find(args.user)
		.select("sub")
		.limit(2)
		.lean<{ sub: string }[]>();
	const [match] = matches;
	if (!match) throw new Error("No user matches");
	if (matches.length > 1) {
		throw new Error("Several users share this username; use --sub");
	}
	const update =
		args.expiresAt === null
			? { $set: { plan: args.plan }, $unset: { planExpiresAt: 1 } }
			: { $set: { plan: args.plan, planExpiresAt: args.expiresAt } };
	const user = await UserModel.findOneAndUpdate({ sub: match.sub }, update, {
		returnDocument: "after",
	}).lean<{
		sub: string;
		username: string;
		plan: PlanId;
		planExpiresAt?: Date | null;
	}>();
	if (!user) throw new Error("User disappeared during the update");
	return {
		sub: user.sub,
		username: user.username,
		plan: user.plan,
		planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
	};
}
