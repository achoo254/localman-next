import { z } from "zod";

/** What the person wants Pro for (multi-select on the form). */
export const PRO_INTEREST_NEEDS = [
	"mock",
	"api_client",
	"team",
	"devops_ci",
	"mcp",
	"tunelo",
] as const;
export type ProInterestNeed = (typeof PRO_INTEREST_NEEDS)[number];

export const PRO_INTEREST_TEAM_SIZES = ["1", "2-5", "6-20", ">20"] as const;
export type ProInterestTeamSize = (typeof PRO_INTEREST_TEAM_SIZES)[number];

export const PRO_INTEREST_NAME_MAX = 100;
export const PRO_INTEREST_PRICE_HINT_MAX = 100;
export const PRO_INTEREST_NOTE_MAX = 1000;

/**
 * Where the form was opened. The web app sends one of these; anything
 * else is stored as `other` instead of being rejected, so a stale client
 * can still submit and the admin statistics keep a closed set of values.
 */
export const PRO_INTEREST_SOURCES = [
	"landing",
	"pricing",
	"subscription_modal",
	"plan_limit_projects",
	"plan_limit_resources",
	"plan_limit_members",
	"plan_limit_proxy",
	"devops",
	"account",
	"other",
] as const;
export type ProInterestSource = (typeof PRO_INTEREST_SOURCES)[number];

function toKnownSource(value: string | undefined): ProInterestSource {
	return PRO_INTEREST_SOURCES.find((source) => source === value) ?? "other";
}

/** Lower-cased, trimmed email: the key that merges repeated submissions. */
export const proInterestEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(254)
	.pipe(z.email("Enter a valid email address"));

/** Body of `POST /api/v1/feedback/pro-interest`. */
export const proInterestSubmissionSchema = z.object({
	email: proInterestEmailSchema,
	name: z.string().trim().min(1).max(PRO_INTEREST_NAME_MAX),
	needs: z
		.array(z.enum(PRO_INTEREST_NEEDS))
		.min(1, "Choose at least one need")
		.max(PRO_INTEREST_NEEDS.length)
		.refine((needs) => new Set(needs).size === needs.length, {
			message: "Needs must not repeat",
		}),
	teamSize: z.enum(PRO_INTEREST_TEAM_SIZES),
	priceHint: z.string().trim().max(PRO_INTEREST_PRICE_HINT_MAX).optional(),
	note: z.string().trim().max(PRO_INTEREST_NOTE_MAX).optional(),
	source: z.string().max(100).optional().transform(toKnownSource),
	/** Consent to store the email for contact about Pro; must be `true`. */
	consent: z.literal(true, {
		error: "Consent is required to store your email",
	}),
	/** Cloudflare Turnstile token; required from guests when enabled. */
	turnstileToken: z.string().max(2048).optional(),
	/** Honeypot: hidden on the form, so only bots fill it in. */
	website: z.string().max(200).optional(),
});

export type ProInterestSubmission = z.output<
	typeof proInterestSubmissionSchema
>;
