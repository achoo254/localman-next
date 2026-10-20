/**
 * Facts of the public legal pages that are not text: their paths, the
 * effective date and the processors' policy links. The claims themselves
 * and their sources are listed in `docs/legal-pages-review.md`.
 */

export const LEGAL_PATHS = {
	privacy: "/privacy",
	terms: "/terms",
	/** Stable public page on how to delete an account (store listings link it). */
	accountDelete: "/account/delete",
} as const;

/** Query `/account/delete` gets after a deletion, to confirm it there. */
export const ACCOUNT_DELETED_QUERY = "deleted";

/**
 * Day the current privacy policy and terms take effect (ISO, Saigon).
 * Set it to the day the owner approves them, before they are deployed.
 */
export const LEGAL_EFFECTIVE_DATE = "2026-10-20T00:00:00+07:00";

/** Privacy policies of the processors, by the tag the texts open them with. */
export const PROCESSOR_POLICY_URLS = {
	cloudflare: "https://www.cloudflare.com/privacypolicy/",
	telegram: "https://telegram.org/privacy",
} as const;
