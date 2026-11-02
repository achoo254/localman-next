import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import { tenantSettings } from "../../tenancy/tenant-settings.js";

const shared = {
	method: "GET",
	input: z.object({}),
	output: z.object({ turnstileSiteKey: z.string().nullable() }),
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "feedback",
	mcp: {
		exempt: "Chỉ widget Turnstile trên trình duyệt cần site key để hiện form",
	},
	handler: () => ({
		turnstileSiteKey: tenantSettings().turnstile?.siteKey ?? null,
	}),
} as const;

export const getFeedbackFormConfig = defineOperation({
	...shared,
	id: "feedback.getFormConfig",
	path: "/feedback/config",
	summary: "Get the feedback form settings",
	description:
		"Public. The Cloudflare Turnstile site key guests must solve on the feedback / contact form, or null when Turnstile is off.",
});

/**
 * The same answer at the path the contact form used while it shared its
 * settings with the retired Pro interest form. Shipped clients (the native
 * app's bundled web build) still read it, so it stays.
 */
export const getFeedbackFormConfigLegacy = defineOperation({
	...shared,
	id: "feedback.getProInterestFormConfig",
	path: "/feedback/pro-interest/config",
	summary: "Get the feedback form settings (old path)",
	description:
		"Deprecated alias of `GET /feedback/config`, kept for older clients.",
});

export const feedbackFormConfigOperations: readonly AnyOperation[] = [
	getFeedbackFormConfig,
	getFeedbackFormConfigLegacy,
];
