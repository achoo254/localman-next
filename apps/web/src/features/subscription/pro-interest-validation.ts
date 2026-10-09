import {
	type ProInterestNeed,
	type ProInterestSubmission,
	type ProInterestTeamSize,
	proInterestSubmissionSchema,
} from "@localman/shared";
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

export type ProInterestErrors = Partial<Record<ProInterestField, string>>;

const MESSAGES: Readonly<Record<Exclude<ProInterestField, "email">, string>> = {
	name: "Nhập tên để chúng tôi biết cách xưng hô.",
	needs: "Chọn ít nhất một nhu cầu.",
	teamSize: "Chọn quy mô team.",
	note: "Ghi chú quá dài, rút gọn bớt.",
	consent: "Cần bạn đồng ý để Localman lưu email và liên hệ.",
	turnstile: "Hoàn tất xác minh trước khi gửi.",
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
 * Checks the body with the API's own schema and maps problems to Vietnamese
 * field messages. Returns the body when it can be sent.
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
						? "Nhập email để chúng tôi liên hệ."
						: "Email chưa đúng định dạng.";
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
