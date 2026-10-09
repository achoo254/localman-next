/** Session check, sign-in errors and account names (`features/auth`). */
export const auth = {
	status: {
		loading: "Checking your session…",
		redirecting: "Redirecting to sign-in…",
		errorTitle: "Couldn't check your session",
		loginLoop:
			"You were sent to sign-in several times but the session wasn't kept. Check that your browser isn't blocking Localman's cookies, then try again.",
	},
	/** Reasons `/auth/callback` sends back in `?authError=`. */
	callbackError: {
		access_denied: {
			title: "You cancelled sign-in",
			text: "Localman isn't allowed to access your hoandat account yet. Sign in again when you're ready.",
		},
		login_expired: {
			title: "Your sign-in expired",
			text: "The sign-in step took too long to finish. Please sign in again.",
		},
		login_failed: {
			title: "Sign-in failed",
			text: "Something went wrong while finishing sign-in. Please try again.",
		},
		rate_limited: {
			title: "Too many sign-in attempts",
			text: "You tried to sign in too many times. Please wait a minute and try again.",
		},
		idp_unavailable: {
			title: "Can't reach your hoandat account",
			text: "The sign-in server isn't responding. Please try again in a few minutes.",
		},
	},
	/** Shown when the user has no name, username or email. */
	accountFallback: "Account",
} as const;
