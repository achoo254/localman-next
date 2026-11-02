import { defineOperation } from "@localman/operations";
import { LIMITS } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { saigonMonth } from "../../time/saigon-time.js";
import { ProjectModel } from "../projects/project-model.js";
import { LEGACY_PLAN, legacyPlanSchema } from "./legacy-plan-field.js";
import { toJsonLimit } from "./limit-guard.js";
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
	summary: "Get usage of the signed-in user",
	description:
		"Owned projects against the project limit, and this month's mock and proxy requests (Asia/Saigon calendar) against the monthly limits. Every account has the same limits. `max: null` means unlimited.",
	input: z.object({}),
	output: z.object({
		plan: legacyPlanSchema,
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
		const [ownedProjects, usage] = await Promise.all([
			ProjectModel.countDocuments({ owner: sub }),
			readUsage(sub, now),
		]);
		return {
			plan: LEGACY_PLAN,
			period: saigonMonth(now),
			projects: { used: ownedProjects, max: toJsonLimit(LIMITS.projects) },
			mockRequests: {
				used: usage.mockRequests,
				max: toJsonLimit(LIMITS.mockRequestsPerMonth),
			},
			proxyRequests: {
				used: usage.proxyRequests,
				max: toJsonLimit(LIMITS.proxyRequestsPerMonth),
			},
		};
	},
});
