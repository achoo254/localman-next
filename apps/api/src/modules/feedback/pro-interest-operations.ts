import { defineOperation } from "@localman/operations";
import { proInterestSubmissionSchema } from "@localman/shared";
import { z } from "zod";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	assertHumanGuest,
	recordProInterest,
	takeProInterestSlot,
} from "./pro-interest-service.js";

const BROWSER_FORM_ONLY =
	"Form công khai cho người: khách phải qua Cloudflare Turnstile (agent không giải được) và việc để lại email liên hệ phải do chính người đó đồng ý";

export const submitProInterest = defineOperation({
	id: "feedback.submitProInterest",
	method: "POST",
	path: "/feedback/pro-interest",
	summary: "Register interest in the Pro plan",
	description:
		"Public. Stores the email (merged by email), needs, team size and the form source after explicit consent, then alerts the owner. Guests need a Turnstile token (widget action `pro_interest`) when it is enabled; a signed-in sender is linked to a new entry. An entry linked to an account keeps its answers when someone else submits the same email; that submission is only added to its history.",
	input: proInterestSubmissionSchema,
	output: z.object({ received: z.boolean() }),
	scopes: [],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "feedback",
	mcp: { exempt: BROWSER_FORM_ONLY },
	successStatus: 201,
	handler: async (ctx, input) => {
		const userSub = ctx.auth?.subjectId ?? null;
		const caller = { userSub, clientIp: ctx.clientIp };
		await takeProInterestSlot(caller);
		// Honeypot filled: only a bot sees the hidden field. Answer as if
		// stored, before any other check, so it learns nothing.
		if (input.website) return { received: true };
		await assertHumanGuest(caller, input.turnstileToken);
		await recordProInterest(input, userSub);
		return { received: true };
	},
});

export const getProInterestFormConfig = defineOperation({
	id: "feedback.getProInterestFormConfig",
	method: "GET",
	path: "/feedback/pro-interest/config",
	summary: "Get the Pro interest form settings",
	description:
		"Public. The Cloudflare Turnstile site key guests must solve, or null when Turnstile is off.",
	input: z.object({}),
	output: z.object({ turnstileSiteKey: z.string().nullable() }),
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "feedback",
	mcp: {
		exempt: "Chỉ widget Turnstile trên trình duyệt cần site key để hiện form",
	},
	handler: () => ({
		turnstileSiteKey: runtimeSettings().turnstile?.siteKey ?? null,
	}),
});
