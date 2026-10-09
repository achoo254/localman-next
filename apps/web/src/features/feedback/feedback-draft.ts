/**
 * Draft, limits and checks of the "Feedback / Contact" form. Limits mirror
 * `POST /api/v1/feedback/contact`, which validates again. Texts live in
 * the `feedback` dictionary; this module only names them.
 */

import {
	CONTACT_CATEGORIES,
	CONTACT_EMAIL_PATTERN,
	CONTACT_MESSAGE_MAX,
	CONTACT_NAME_MAX,
	CONTACT_SOURCES,
	type ContactCategory,
	type ContactSource,
	TELEGRAM_USERNAME_PATTERN,
} from "@localman/shared/constants";
import { isRecord } from "../../lib/json-guards";

/** Key of each category under `feedback.categories`. */
const CATEGORY_KEYS = {
	feedback: "feedback",
	bug: "bug",
	plan_question: "planQuestion",
} as const satisfies Record<ContactCategory, string>;

/** The "Type" choices in the API's order, with their dictionary key. */
export const FEEDBACK_CATEGORIES = CONTACT_CATEGORIES.map((id) => ({
	id,
	key: CATEGORY_KEYS[id],
}));

/**
 * Area of the app a path belongs to. Only the first segment is used, so ids
 * and tokens in the path (`/invite/:token`) are never sent.
 */
export function feedbackSourceFor(pathname: string): ContactSource {
	const first = pathname.split("/").find((segment) => segment !== "") ?? "";
	if (first === "") return "landing";
	return (
		CONTACT_SOURCES.find(
			(source) => source === first && source !== "landing",
		) ?? "other"
	);
}

export interface FeedbackDraft {
	category: ContactCategory;
	message: string;
	name: string;
	/** Email or Telegram username, optional. */
	contact: string;
	/** Hidden `contact_extra` input; only bots fill it. */
	honeypot: string;
}

/** Name and email of a signed-in user are prefilled (and editable). */
export function emptyDraft(
	account: { name: string | null; email: string | null } | null,
): FeedbackDraft {
	return {
		category: "feedback",
		message: "",
		name: (account?.name ?? "").slice(0, CONTACT_NAME_MAX),
		contact: account?.email ?? "",
		honeypot: "",
	};
}

export type FeedbackField = "message" | "name" | "contact" | "turnstile";
/** Key under `feedback.errors` of what is wrong with a field. */
export type FeedbackError =
	| "messageRequired"
	| "messageTooLong"
	| "nameTooLong"
	| "contactInvalid"
	| "turnstile";
export type FeedbackErrors = Partial<Record<FeedbackField, FeedbackError>>;

/** The error of a field the API refused, whatever its own reason. */
const FIELD_ERRORS: Readonly<Record<FeedbackField, FeedbackError>> = {
	message: "messageTooLong",
	name: "nameTooLong",
	contact: "contactInvalid",
	turnstile: "turnstile",
};

/** Field errors of the draft; empty when it can be sent. */
export function validateFeedback(
	draft: FeedbackDraft,
	needsTurnstile: boolean,
	turnstileToken: string | null,
): FeedbackErrors {
	const errors: FeedbackErrors = {};
	const message = draft.message.trim();
	if (message === "") errors.message = "messageRequired";
	else if (message.length > CONTACT_MESSAGE_MAX) {
		errors.message = FIELD_ERRORS.message;
	}
	if (draft.name.trim().length > CONTACT_NAME_MAX) {
		errors.name = FIELD_ERRORS.name;
	}
	const contact = draft.contact.trim();
	if (
		contact &&
		!CONTACT_EMAIL_PATTERN.test(contact) &&
		!TELEGRAM_USERNAME_PATTERN.test(contact)
	) {
		errors.contact = FIELD_ERRORS.contact;
	}
	if (needsTurnstile && !turnstileToken) {
		errors.turnstile = FIELD_ERRORS.turnstile;
	}
	return errors;
}

function isField(key: unknown): key is Exclude<FeedbackField, "turnstile"> {
	return key === "message" || key === "name" || key === "contact";
}

/**
 * Field errors from the `details` of a 400 `VALIDATION_ERROR` (each
 * `{ path, message }`, `path` naming the body field); empty when none
 * names a field of the form.
 */
export function fieldErrorsFromDetails(details: unknown): FeedbackErrors {
	const errors: FeedbackErrors = {};
	if (!Array.isArray(details)) return errors;
	for (const detail of details) {
		const path: unknown = isRecord(detail) ? detail.path : undefined;
		const field = Array.isArray(path) ? path[0] : path;
		if (isField(field)) errors[field] = FIELD_ERRORS[field];
	}
	return errors;
}

/** Request body; empty optional fields are left out. */
export function toFeedbackBody(
	draft: FeedbackDraft,
	source: ContactSource,
	turnstileToken: string | null,
): Record<string, string> {
	const name = draft.name.trim();
	const contact = draft.contact.trim();
	return {
		category: draft.category,
		message: draft.message.trim(),
		...(name ? { name } : {}),
		...(contact ? { contact } : {}),
		source,
		...(turnstileToken ? { turnstileToken } : {}),
		// The API names the honeypot `website` in the request body.
		website: draft.honeypot,
	};
}
