import {
	CONTACT_CATEGORIES,
	CONTACT_EMAIL_PATTERN,
	CONTACT_HANDLE_MAX,
	CONTACT_MESSAGE_MAX,
	CONTACT_NAME_MAX,
	CONTACT_SOURCES,
	type ContactSource,
	TELEGRAM_USERNAME_PATTERN,
} from "@localman/shared";
import { z } from "zod";

export interface ParsedContact {
	readonly contact: string;
	readonly contactKind: "email" | "telegram";
}

/**
 * Reply address as stored: a lower-cased email, or a Telegram username
 * with its `@`. `null` when the text is neither.
 */
export function parseContact(text: string): ParsedContact | null {
	const lower = text.trim().toLowerCase();
	if (CONTACT_EMAIL_PATTERN.test(lower)) {
		return { contact: lower, contactKind: "email" };
	}
	const handle = TELEGRAM_USERNAME_PATTERN.exec(text.trim())?.[1];
	return handle ? { contact: `@${handle}`, contactKind: "telegram" } : null;
}

function toKnownSource(value: string | undefined): ContactSource {
	return CONTACT_SOURCES.find((source) => source === value) ?? "other";
}

/** Body of `POST /api/v1/feedback/contact`. */
export const contactMessageSubmissionSchema = z.object({
	category: z.enum(CONTACT_CATEGORIES).default("feedback"),
	message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX),
	/** Optional; an empty value counts as not given. */
	name: z.string().trim().max(CONTACT_NAME_MAX).optional(),
	/** Optional email or Telegram username to reply to. */
	contact: z
		.string()
		.trim()
		.max(CONTACT_HANDLE_MAX)
		.optional()
		.refine((value) => !value || parseContact(value) !== null, {
			message: "Enter an email address or a Telegram username",
		}),
	/** Area the form was opened from; unknown values become `other`. */
	source: z.string().max(100).optional().transform(toKnownSource),
	/** Cloudflare Turnstile token; required from guests when enabled. */
	turnstileToken: z.string().max(2048).optional(),
	/** Honeypot: hidden on the form, so only bots fill it in. */
	website: z.string().max(200).optional(),
});

export type ContactMessageSubmission = z.output<
	typeof contactMessageSubmissionSchema
>;
