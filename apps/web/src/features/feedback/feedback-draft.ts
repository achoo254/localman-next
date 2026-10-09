/**
 * Draft, limits and checks of the "Góp ý / Liên hệ" form. Limits mirror
 * `POST /api/v1/feedback/contact`, which validates again.
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
import { formatNumber } from "../../lib/format";
import { isRecord } from "../../lib/json-guards";

const CATEGORY_COPY: Readonly<
	Record<ContactCategory, { label: string; placeholder: string }>
> = {
	feedback: {
		label: "Góp ý",
		placeholder: "Bạn muốn Localman làm tốt hơn điều gì?",
	},
	bug: {
		label: "Báo lỗi",
		placeholder: "Bạn đang làm gì thì gặp lỗi, và lỗi hiện ra thế nào?",
	},
	plan_question: {
		label: "Hỏi về gói",
		placeholder: "Bạn cần hạn mức hay tính năng nào?",
	},
};

/** The "Loại" choices in the API's order, with their copy. */
export const FEEDBACK_CATEGORIES = CONTACT_CATEGORIES.map((id) => ({
	id,
	...CATEGORY_COPY[id],
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
export type FeedbackErrors = Partial<Record<FeedbackField, string>>;

const FIELD_MESSAGES: Readonly<Record<FeedbackField, string>> = {
	message: `Nhập nội dung, tối đa ${formatNumber(CONTACT_MESSAGE_MAX)} ký tự.`,
	name: `Tên tối đa ${formatNumber(CONTACT_NAME_MAX)} ký tự.`,
	contact: "Nhập email hoặc username Telegram hợp lệ, hoặc để trống.",
	turnstile: "Hoàn tất xác minh trước khi gửi.",
};

/** Field messages for the draft; empty when it can be sent. */
export function validateFeedback(
	draft: FeedbackDraft,
	needsTurnstile: boolean,
	turnstileToken: string | null,
): FeedbackErrors {
	const errors: FeedbackErrors = {};
	const message = draft.message.trim();
	if (message === "") errors.message = "Nhập nội dung.";
	else if (message.length > CONTACT_MESSAGE_MAX) {
		errors.message = FIELD_MESSAGES.message;
	}
	if (draft.name.trim().length > CONTACT_NAME_MAX) {
		errors.name = FIELD_MESSAGES.name;
	}
	const contact = draft.contact.trim();
	if (
		contact &&
		!CONTACT_EMAIL_PATTERN.test(contact) &&
		!TELEGRAM_USERNAME_PATTERN.test(contact)
	) {
		errors.contact = FIELD_MESSAGES.contact;
	}
	if (needsTurnstile && !turnstileToken) {
		errors.turnstile = FIELD_MESSAGES.turnstile;
	}
	return errors;
}

function isField(key: unknown): key is Exclude<FeedbackField, "turnstile"> {
	return key === "message" || key === "name" || key === "contact";
}

/**
 * Field messages from the `details` of a 400 `VALIDATION_ERROR` (each
 * `{ path, message }`, `path` naming the body field); empty when none
 * names a field of the form.
 */
export function fieldErrorsFromDetails(details: unknown): FeedbackErrors {
	const errors: FeedbackErrors = {};
	if (!Array.isArray(details)) return errors;
	for (const detail of details) {
		const path: unknown = isRecord(detail) ? detail.path : undefined;
		const field = Array.isArray(path) ? path[0] : path;
		if (isField(field)) errors[field] = FIELD_MESSAGES[field];
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
