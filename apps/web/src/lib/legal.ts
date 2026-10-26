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
	/** Where the data of the API client lives (`secretVault` flag). */
	yourData: "/your-data",
} as const;

/** Query `/account/delete` gets after a deletion, to confirm it there. */
export const ACCOUNT_DELETED_QUERY = "deleted";

/**
 * Day the current privacy policy and terms take effect (ISO, Saigon):
 * the day they were approved. Change it with every change of the texts.
 */
export const LEGAL_EFFECTIVE_DATE = "2026-10-26T00:00:00+07:00";

/**
 * Public contact of the operator (the same address as the operator's
 * other apps' legal pages): questions, data requests and account
 * deletion without signing in.
 */
export const SUPPORT_EMAIL = "quocdat254@gmail.com";

/**
 * Whether the pages are served for the hoandat.com service, whose server
 * location is known (Vietnam, whois of the server's address); another
 * domain's operator states its own.
 */
export function isPrimaryService(appHost: string): boolean {
	return appHost === "hoandat.com" || appHost.endsWith(".hoandat.com");
}

/** Privacy policies of the processors, by the tag the texts open them with. */
export const PROCESSOR_POLICY_URLS = {
	cloudflare: "https://www.cloudflare.com/privacypolicy/",
	telegram: "https://telegram.org/privacy",
} as const;
