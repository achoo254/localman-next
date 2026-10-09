/**
 * Values of the public feedback forms shared by the web app and the API:
 * the "Góp ý / Liên hệ" form's choices and limits, and the Cloudflare
 * Turnstile `action` of each form. No zod, so light clients can import it
 * from `@localman/shared/constants`.
 */

/**
 * Turnstile `action` each form's widget declares; the API refuses a token
 * solved for another form.
 */
export const TURNSTILE_ACTIONS = {
	proInterest: "pro_interest",
	contact: "contact",
} as const;
export type TurnstileAction =
	(typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];

/** What a contact message is about (the "Loại" select). */
export const CONTACT_CATEGORIES = ["feedback", "bug", "plan_question"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

/** Owner follow-up of a contact message: unread, read, then handled. */
export const CONTACT_STATUSES = ["new", "read", "resolved"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Area of the app the form was opened from. A closed set instead of the
 * page URL, so ids and tokens in paths (`/invite/:token`) are never sent;
 * the API stores anything else as `other`.
 */
export const CONTACT_SOURCES = [
	"landing",
	"projects",
	"account",
	"admin",
	"invite",
	"docs",
	"other",
] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const CONTACT_NAME_MAX = 100;
/** Email or Telegram username to reply to. */
export const CONTACT_HANDLE_MAX = 254;
export const CONTACT_MESSAGE_MAX = 2000;

/**
 * Reply email of the contact form, checked the same way by the form and
 * the API: one `@`, no spaces, a dot in the domain.
 */
export const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Telegram username rules: 5–32 characters, starts with a letter. */
export const TELEGRAM_USERNAME_PATTERN = /^@?([a-z][a-z0-9_]{4,31})$/i;
