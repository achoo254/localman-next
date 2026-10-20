/**
 * Public legal pages (`/privacy`, `/terms`, `/account/delete`) and the
 * links to them. A section body is paragraphs separated by a blank line;
 * a paragraph whose lines all start with "- " is a list. Tags open links
 * (`pages/legal/legal-body.tsx`): one tag per destination, so URLs live in
 * code, not in the text. Every claim is listed with its source in
 * `docs/legal-pages-review.md`; change both together.
 */
export const legal = {
	effective: "Effective {date}",
	nav: {
		label: "Legal",
		privacy: "Privacy",
		terms: "Terms",
		deleteAccount: "Delete account",
	},
	signUpNote:
		"By signing up you agree to the <terms>Terms</terms> and the <privacy>Privacy Policy</privacy>.",
	contact: {
		title: "Contact",
		body: "Questions or requests about your data or these terms: email <email>{email}</email>, or use “Feedback / Contact” at the bottom of any Localman page (leave a way to reach you if you want an answer).",
	},
	pending: {
		title: "Being updated",
		body: "These parts are not written yet; they will be added here:",
		items: {
			operator: "Who operates Localman (the legal entity)",
			minimumAge: "The minimum age to use Localman",
			liability: "Limits of liability",
			governingLaw: "Governing law and disputes",
			logRetention: "How long server logs are kept",
		},
	},
	accountDelete: {
		title: "Delete your Localman account",
		intro:
			"You can delete your Localman account and its data yourself, at any time, from the web app. This page explains how and what happens.",
		deleted:
			"Your Localman account was deleted. Signing in again creates a new, empty account.",
		howTitle: "How to delete it",
		how: "- Sign in to Localman.\n- In the account menu, open <b>Account and limits</b>.\n- Under <b>Delete account</b>, choose <b>Delete account…</b>, check what will be removed, type your username and confirm.",
		openAccount: "Go to Account",
		whatTitle: "What is deleted",
		what: "- Mock projects you own, with their resources, data, request logs, webhook inboxes and callbacks, also for the people you shared them with.\n- Your personal workspace and team workspaces where you are the only member, with their collections and environments.\n- Your API client history, open tabs and settings, notifications and their settings, Web Push devices, usage counters, links to Tunelo machines (revoked at Tunelo), messages you sent with the feedback forms while signed in, and every sign-in session.\n- In team workspaces that have other members, you leave the workspace. What you wrote there (collections, requests, comments, changelog) belongs to the team and stays, but your name is removed from it.",
		blockedTitle: "When deletion has to wait",
		blocked:
			"If you are the only Admin of a team workspace that has other members, make another member Admin (or remove the other members) first. The deletion screen lists those workspaces.",
		keptTitle: "What is kept, and for how long",
		kept: "- Database backups are taken every night and the latest 14 are kept, so deleted data can remain in a backup for up to 14 days.\n- Notifications other people received about your actions keep the text they were sent with until they expire (90 days).\n- Messages you sent with the feedback form while signed out cannot be linked to your account; ask through the form to have them deleted.",
		idpTitle: "Your {idpName} sign-in account",
		idp: "Localman does not have your password: you sign in with your {idpName} account, which other apps may also use. Deleting your Localman account leaves it in place. To delete it as well, go to <idpDelete>your {idpName} account page</idpDelete>.",
		noAccessTitle: "Ask by email, without signing in",
		noAccess:
			"If you can't sign in, email <email>{email}</email> and ask for your account to be deleted. Give your Localman username and the email address of your {idpName} account, so the account can be found. You can also use “Feedback / Contact” at the bottom of this page.",
	},
} as const;
