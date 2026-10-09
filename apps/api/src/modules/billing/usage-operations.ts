import { defineOperation } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { saigonMonth } from "../../time/saigon-time.js";
import { ProjectModel } from "../projects/project-model.js";
import { effectivePlan, storedPlanOf, toJsonLimit } from "./plan-guard.js";
import { readUsage } from "./usage-counter-model.js";

/** `max: null` means no cap (projects) or no monthly cap (requests). */
const meter = z.object({
	used: z.number().int().min(0),
	max: z.number().int().min(0).nullable(),
});

export const getAccountUsage = defineOperation({
	id: "users.getAccountUsage",
	method: "GET",
	path: "/account/usage",
	summary: "Get plan usage of the signed-in user",
	description:
		"The plan in force (an expired Pro counts as Free), owned projects against the project limit, and this month's mock and proxy requests (Asia/Saigon calendar) against the monthly limits. `max: null` means unlimited.",
	input: z.object({}),
	output: z.object({
		plan: z.enum(["free", "pro"]),
		planExpiresAt: z.string().nullable(),
		period: z.string().regex(/^\d{4}-\d{2}$/),
		projects: meter,
		mockRequests: meter,
		proxyRequests: meter,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: true,
	handler: async (ctx) => {
		const sub = requireSubject(ctx);
		const now = new Date();
		const [stored, ownedProjects, usage] = await Promise.all([
			storedPlanOf(sub),
			ProjectModel.countDocuments({ owner: sub }),
			readUsage(sub, now),
		]);
		const plan = effectivePlan(stored, now);
		const limits = limitsFor(plan);
		return {
			plan,
			planExpiresAt: stored.planExpiresAt?.toISOString() ?? null,
			period: saigonMonth(now),
			projects: { used: ownedProjects, max: toJsonLimit(limits.projects) },
			mockRequests: {
				used: usage.mockRequests,
				max: toJsonLimit(limits.mockRequestsPerMonth),
			},
			proxyRequests: {
				used: usage.proxyRequests,
				max: toJsonLimit(limits.proxyRequestsPerMonth),
			},
		};
	},
});
