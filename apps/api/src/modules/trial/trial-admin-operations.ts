import { defineOperation } from "@localman/operations";
import {
	TRIAL_DIRECT_EXTENSION_MAX_DAYS,
	TRIAL_EXTENSION_DAYS,
} from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { ownerOnly } from "../users/owner-access.js";
import {
	decideExtension,
	extensionItemSchema,
	listExtensions,
	reopenExtension,
	toExtensionItems,
} from "./trial-admin-service.js";
import { notifyDeclined, notifyExtended } from "./trial-notices.js";
import { TRIAL_MCP_EXEMPT } from "./trial-operations.js";
import { extendPro, trialLog } from "./trial-plan.js";

const OWNER_NOTE =
	"Localman owners only (OWNER_SUBS); others get 403 before any input check.";
const WRITE = {
	readOnly: false,
	destructive: false,
	idempotent: false,
} as const;
const requestId = z.string().min(1).max(64);

/** One decided request, as listed. */
async function itemOf(
	request: Parameters<typeof toExtensionItems>[0][number],
): Promise<z.output<typeof extensionItemSchema>> {
	const [item] = await toExtensionItems([request]);
	if (!item) throw new Error("A listed request has no item");
	return item;
}

export const listTrialExtensions = defineOperation({
	id: "admin.listTrialExtensions",
	method: "GET",
	path: "/admin/trial-extensions",
	summary: "List Pro trial extension requests",
	description: `Newest first, pending ones (default) or all, 50 per page; pass \`nextCursor\` as \`cursor\` for the next page. Each item has the user, their reason, and their current trial end. ${OWNER_NOTE}`,
	input: z.object({
		status: z.enum(["pending", "all"]).default("pending"),
		cursor: z.string().max(64).optional(),
	}),
	output: z.object({
		items: z.array(extensionItemSchema),
		nextCursor: z.string().nullable(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "admin",
	mcp: TRIAL_MCP_EXEMPT,
	handler: (_ctx, input) => listExtensions(input.status, input.cursor),
});

export const approveTrialExtension = defineOperation({
	id: "admin.approveTrialExtension",
	method: "POST",
	path: "/admin/trial-extensions/:requestId/approve",
	summary: "Approve a Pro trial extension request",
	description: `The user stays Pro until the end of the Asia/Saigon day ${TRIAL_EXTENSION_DAYS} days after the later of now and their current end, and is notified. 409 \`EXTENSION_DECIDED\` when already decided. ${OWNER_NOTE}`,
	input: z.object({ requestId }),
	output: extensionItemSchema,
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: WRITE,
	toolset: "admin",
	mcp: TRIAL_MCP_EXEMPT,
	handler: async (ctx, input) => {
		const owner = requireSubject(ctx);
		const now = new Date();
		const request = await decideExtension(
			input.requestId,
			"approved",
			owner,
			now,
		);
		let endsAt: Date;
		try {
			endsAt = await extendPro(request.userSub, TRIAL_EXTENSION_DAYS, now);
		} catch (error) {
			await reopenExtension(request._id);
			throw error;
		}
		trialLog().info(
			{ requestId: input.requestId, sub: request.userSub, by: owner, endsAt },
			"Trial extension approved",
		);
		notifyExtended(request.userSub, endsAt);
		return itemOf(request);
	},
});

export const declineTrialExtension = defineOperation({
	id: "admin.declineTrialExtension",
	method: "POST",
	path: "/admin/trial-extensions/:requestId/decline",
	summary: "Decline a Pro trial extension request",
	description: `The trial keeps its end and the user is notified. 409 \`EXTENSION_DECIDED\` when already decided. ${OWNER_NOTE}`,
	input: z.object({ requestId }),
	output: extensionItemSchema,
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: WRITE,
	toolset: "admin",
	mcp: TRIAL_MCP_EXEMPT,
	handler: async (ctx, input) => {
		const owner = requireSubject(ctx);
		const request = await decideExtension(
			input.requestId,
			"declined",
			owner,
			new Date(),
		);
		trialLog().info(
			{ requestId: input.requestId, sub: request.userSub, by: owner },
			"Trial extension declined",
		);
		notifyDeclined(request.userSub);
		return itemOf(request);
	},
});

export const extendUserTrial = defineOperation({
	id: "admin.extendUserTrial",
	method: "POST",
	path: "/admin/users/:sub/extend-trial",
	summary: "Extend a user's Pro directly",
	description: `Pro until the end of the Asia/Saigon day \`days\` (1-${TRIAL_DIRECT_EXTENSION_MAX_DAYS}) days after the later of now and the current end; the user is notified. Works for any user, with or without a trial; pending requests stay pending. 404 \`NOT_FOUND\` for an unknown user, 409 \`PLAN_HAS_NO_EXPIRY\` for a Pro without end. ${OWNER_NOTE}`,
	input: z.object({
		sub: z.string().min(1).max(200),
		days: z.number().int().min(1).max(TRIAL_DIRECT_EXTENSION_MAX_DAYS),
	}),
	output: z.object({
		sub: z.string(),
		plan: z.literal("pro"),
		planExpiresAt: z.string(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: WRITE,
	toolset: "admin",
	mcp: TRIAL_MCP_EXEMPT,
	handler: async (ctx, input) => {
		const owner = requireSubject(ctx);
		const endsAt = await extendPro(input.sub, input.days, new Date());
		trialLog().info(
			{ sub: input.sub, by: owner, days: input.days, endsAt },
			"Trial extended directly",
		);
		notifyExtended(input.sub, endsAt);
		return {
			sub: input.sub,
			plan: "pro" as const,
			planExpiresAt: endsAt.toISOString(),
		};
	},
});

export const trialAdminOperations = [
	listTrialExtensions,
	approveTrialExtension,
	declineTrialExtension,
	extendUserTrial,
] as const;
