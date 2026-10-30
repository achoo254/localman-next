/** `/invite/:token`: invitations and magic links opened by the invitee. */
export const invite = {
	pageTitle: "Project invitation",
	signIn: {
		title: "You're invited to join a project on Localman",
		text: "Sign in or create a {idpName} account to see the invitation. You'll come back to this page afterwards.",
		signIn: "Sign in",
		signUp: "Sign up",
	},
	loading: "Checking the invitation…",
	failedTitle: "Couldn't open the invitation",
	backToProjects: "Back to Projects",
	toast: {
		joined: "Joined {project}",
		alreadyMember: "You're already a member of {project}",
	},
	invalid: {
		expiredTitle: "This invite link has expired",
		expiredText:
			"The link expired on {date}. Ask the person who invited you for a new link.",
		expiredTextNoDate: "Ask the person who invited you for a new link.",
		usedTitle: "This invite link has already been used",
		usedText:
			"Each invite link works only once. Ask the person who invited you for a new link.",
		revokedTitle: "This invite link is no longer valid",
		revokedText: "The project owner revoked this link, or the link is wrong.",
	},
	preview: {
		title: "Join {project}",
		inviter: "{inviter} invited you to collaborate.",
		expiresShared: "Shared link · expires {date}",
		expires: "Expires {date}",
		signedInAs: "You're signed in as <b>{account}</b>",
		alreadyMember: "You're already a member of {project}.",
		openProject: "Open project",
		full: "The project has no free seats. Ask the project owner to remove some members.",
		removed:
			"The project owner removed you from this project. Contact the project owner if you need to join again.",
		ineligibleTitle: "This account can't accept the invitation",
		ineligibleOther:
			"This invitation was sent to another account. Sign in with the invited account.",
		ineligibleUnverified:
			"The invitation was sent to {email}. This account's email isn't verified: sign in with Google, GitHub or Apple using a verified email that matches it.",
		ineligibleWrongAccount:
			"The invitation was sent to {email}. Sign in with the invited account, or link Google, GitHub or Apple with a verified email that matches it (with Apple, share your email instead of hiding it).",
		accept: "Join",
	},
	switchAccount: {
		action: "Sign in with another account",
		hint: "You'll be signed out. Sign in again with the invited account, then reopen this link.",
	},
	/** Errors of `/invite/:token` that are not a state of their own. */
	errors: {
		rateLimited:
			"You've opened too many invite links. Try again in a few minutes.",
		conflict: "The invitation just changed. Please try again.",
		fallback: "Couldn't open the invitation. Try again later.",
	},
} as const;
