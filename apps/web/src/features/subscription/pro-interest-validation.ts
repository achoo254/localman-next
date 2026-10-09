import {
	type ProInterestNeed,
	type ProInterestSubmission,
	type ProInterestTeamSize,
	proInterestSubmissionSchema,
} from "@localman/shared";
import type { SourceMessages } from "../../i18n/message-types";
import type { ProInterestSource } from "./pro-interest-options";

export interface ProInterestDraft {
	email: string;
	name: string;
	needs: ProInterestNeed[];
	teamSize: ProInterestTeamSize | "";
	priceHint: string;
	note: string;
	consent: boolean;
	/** Hidden `contact_extra` input; only bots fill it. */
	honeypot: string;
}

export type ProInterestField =
	| "email"
	| "name"
	| "needs"
	| "teamSize"
	| "note"
	| "consent"
	| "turnstile";

/** Message key of a field problem; the form translates it when rendering. */
export type ProInterestErrorKey =
	`subscription.proInterest.errors.${keyof SourceMessages["subscription"]["proInterest"]["errors"]}`;

export type ProInterestErrors = Partial<
	Record<ProInterestField, ProInterestErrorKey>
>;

const MESSAGES: Readonly<
	Record<Exclude<ProInterestField, "email">, ProInterestErrorKey>
> = {
	name: "subscription.proInterest.errors.name",
	needs: "subscription.proInterest.errors.needs",
	teamSize: "subscription.proInterest.errors.teamSize",
	note: "subscription.proInterest.errors.note",
	consent: "subscription.proInterest.errors.consent",
	turnstile: "subscription.proInterest.errors.turnstile",
};

function isField(key: unknown): key is Exclude<ProInterestField, "email"> {
	return typeof key === "string" && Object.hasOwn(MESSAGES, key);
}

/** Request body built from the draft; empty optional fields are left out. */
export function toSubmission(
	draft: ProInterestDraft,
	source: ProInterestSource,
	turnstileToken: string | null,
): Record<string, unknown> {
	const note = draft.note.trim();
	return {
		email: draft.email.trim(),
		name: draft.name.trim(),
		needs: draft.needs,
		teamSize: draft.teamSize,
		...(draft.priceHint ? { priceHint: draft.priceHint } : {}),
		...(note ? { note } : {}),
		source,
		consent: draft.consent,
		...(turnstileToken ? { turnstileToken } : {}),
		// The API still names the honeypot `website` in the request body.
		website: draft.honeypot,
	};
}

/**
 * Checks the body with the API's own schema and maps problems to field
 * message keys. Returns the body when it can be sent.
 */
export function validateProInterest(
	body: Record<string, unknown>,
	needsTurnstile: boolean,
): { errors: ProInterestErrors; submission: ProInterestSubmission | null } {
	const errors: ProInterestErrors = {};
	const parsed = proInterestSubmissionSchema.safeParse(body);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			const field = issue.path[0];
			if (field === "email") {
				errors.email =
					body.email === ""
						? "subscription.proInterest.errors.emailEmpty"
						: "subscription.proInterest.errors.emailInvalid";
			} else if (isField(field)) {
				errors[field] = MESSAGES[field];
			}
		}
	}
	if (needsTurnstile && !body.turnstileToken) {
		errors.turnstile = MESSAGES.turnstile;
	}
	const clean = Object.keys(errors).length === 0;
	return { errors, submission: parsed.success && clean ? parsed.data : null };
}

export function emptyDraft(
	email: string,
	need: ProInterestNeed | undefined,
): ProInterestDraft {
	return {
		email,
		name: "",
		needs: need ? [need] : [],
		teamSize: "",
		priceHint: "",
		note: "",
		consent: false,
		honeypot: "",
	};
}
