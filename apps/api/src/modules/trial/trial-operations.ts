import { OperationError, defineOperation } from "@localman/operations";
import {
	TRIAL_DAYS,
	TRIAL_EXTENSION_GRACE_DAYS,
	TRIAL_EXTENSION_REASON_MAX,
} from "@localman/shared";
import { z } from "zod";
import type { RateLimitWindow } from "../../config/runtime-settings.js";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import {
	currentUserSchema,
	loadCurrentUser,
	signedOut,
} from "../users/me-view.js";
import { UserModel } from "../users/user-model.js";
import { TrialExtensionModel } from "./trial-extension-model.js";
import { notifyOwnersOfRequest } from "./trial-notices.js";
import { startTrial as startTrialFor, trialLog } from "./trial-plan.js";
import { canRequestExtension, trialStateOf } from "./trial-state.js";

/** Plan changes are decided by people in the web app, never by an agent. */
export const TRIAL_MCP_EXEMPT = {
	exempt:
		"plan decisions are made in the UI: starting or extending a trial, and the owner's approvals, are choices of a person",
} as const;

/** Extension requests per account (each one alerts the owners). */
const EXTENSION_RATE_LIMIT: RateLimitWindow = {
	max: 5,
	windowMs: 24 * 60 * 60_000,
};

export const startTrial = defineOperation({
	id: "users.startTrial",
	method: "POST",
	path: "/users/me/trial",
	summary: "Start the account's Pro trial",
	description: `Makes the signed-in user Pro until the end of the Asia/Saigon day ${TRIAL_DAYS} days later, once per account. Returns the user as \`GET /users/me\`. 409 \`TRIAL_ALREADY_USED\` once a trial was started, 409 \`ALREADY_PRO\` while an owner-granted Pro is in force.`,
	input: z.object({}),
	output: currentUserSchema,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "users",
	mcp: TRIAL_MCP_EXEMPT,
	handler: async (ctx) => {
		const sub = requireSubject(ctx);
		const now = new Date();
		await startTrialFor(sub, now);
		return loadCurrentUser(sub, now);
	},
});

interface Requester {
	sub: string;
	username: string;
	name?: string | null;
	plan: "free" | "pro";
	planExpiresAt?: Date | null;
	trialStartedAt?: Date | null;
}

export const requestTrialExtension = defineOperation({
	id: "users.requestTrialExtension",
	method: "POST",
	path: "/users/me/trial/extension",
	summary: "Ask the owner to extend the Pro trial",
	description: `While the trial runs or within ${TRIAL_EXTENSION_GRACE_DAYS} days after its end, with a short reason (1-${TRIAL_EXTENSION_REASON_MAX} characters) only owners read. One pending request at a time (409 \`EXTENSION_PENDING\`); otherwise 409 \`TRIAL_NOT_EXTENDABLE\`. Returns the user as \`GET /users/me\`.`,
	input: z.object({
		reason: z.string().trim().min(1).max(TRIAL_EXTENSION_REASON_MAX),
	}),
	output: currentUserSchema,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "users",
	mcp: TRIAL_MCP_EXEMPT,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const allowed = await takeRateLimitSlot(
			"trial-extension:user",
			sub,
			EXTENSION_RATE_LIMIT,
		);
		if (!allowed) {
			throw new OperationError(
				429,
				"RATE_LIMITED",
				"Too many extension requests; try again tomorrow",
			);
		}
		const now = new Date();
		const user = await UserModel.findOne({ sub })
			.select("sub username name plan planExpiresAt trialStartedAt")
			.lean<Requester>();
		if (!user) throw signedOut();
		const state = trialStateOf(
			{
				plan: user.plan,
				planExpiresAt: user.planExpiresAt ?? null,
				trialStartedAt: user.trialStartedAt ?? null,
			},
			now,
		);
		if (!canRequestExtension(state, now)) {
			throw new OperationError(
				409,
				"TRIAL_NOT_EXTENDABLE",
				"There is no running or recently ended trial to extend",
			);
		}
		let requestId: string;
		try {
			const created = await TrialExtensionModel.create({
				userSub: sub,
				reason: input.reason,
				status: "pending",
				requestedAt: now,
			});
			requestId = created._id.toHexString();
		} catch (error) {
			if (!isDuplicateKeyError(error)) throw error;
			throw new OperationError(
				409,
				"EXTENSION_PENDING",
				"An extension request is already waiting for the owner",
			);
		}
		trialLog().info({ sub, requestId }, "Trial extension requested");
		await notifyOwnersOfRequest(
			{ sub, username: user.username, name: user.name ?? null },
			state.endsAt,
		).catch((error: unknown) => {
			trialLog().error(
				{ err: error, requestId },
				"Trial extension alert failed",
			);
		});
		return loadCurrentUser(sub, now);
	},
});

export const trialOperations = [startTrial, requestTrialExtension] as const;
