/** Values of the confirmation page; `app` is brand.appName. */
export interface MobileConfirmText {
	readonly app: string;
	/** Email, username or name of the IdP account. */
	readonly account: string;
}

/**
 * English texts of the native app sign-in pages (confirmation and the
 * callback's fallback); the source of the shape the other languages fill.
 */
export const mobileSignInEn = {
	confirmTitle: (p: { readonly app: string }): string =>
		`Sign in to the ${p.app} app`,
	confirmBody: (p: MobileConfirmText): string =>
		`Open the ${p.app} app on this phone as ${p.account}?`,
	confirmHint:
		"Continue only if you started this sign-in from the app on this device.",
	continue: "Continue",
	cancel: "Cancel",
	expiredTitle: "This sign-in has expired",
	expiredBody: "Go back to the app and start signing in again.",
	callbackTitle: (p: { readonly app: string }): string =>
		`Back to the ${p.app} app`,
	callbackBody:
		"If the app did not open by itself, tap the button below. Without the app installed, install it first, then sign in from the app.",
	callbackError:
		"The sign-in did not finish. Go back to the app and try again.",
	openApp: (p: { readonly app: string }): string => `Open ${p.app}`,
};

export type MobileSignInMessages = typeof mobileSignInEn;
