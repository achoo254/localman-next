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
			"You sign in to Localman with your {idpName} account, and that account is deleted only at {idpName}. Deleting it there deletes your data in Localman and in every other app that uses it, at once. This page explains what happens to your Localman data.",
		howTitle: "How to delete it",
		how: "- Open <idpDelete>your {idpName} account page</idpDelete> and sign in.\n- Under <b>Delete account</b>, follow the steps. Localman deletes your data as soon as {idpName} tells it the account is gone.",
		openAccount: "Delete account at {idpName}",
		whatTitle: "What happens to your Localman data",
		what: "- Mock projects you own that have other members go to the member who joined first, with all their data. Your other mock projects are deleted with their resources, data, request logs, webhook inboxes and callbacks.\n- In team workspaces that have other members, you leave the workspace. If you were its only Admin, the member with the highest role (the earliest to join among equals) becomes Admin and owner. What you wrote there (collections, requests, comments, changelog) belongs to the team and stays, but your name is removed from it.\n- Your personal workspace and team workspaces where you are the only member are deleted, with their collections and environments.\n- Your API client history, open tabs and settings, notifications and their settings, Web Push devices, usage counters, links to Tunelo machines (revoked at Tunelo), messages you sent with the feedback forms while signed in, and every sign-in session are deleted.",
		keptTitle: "What is kept, and for how long",
		kept: "- Only a hash of your account ID, so the deleted account is recognised if it ever signs in again.\n- Database backups are taken every night and the latest 14 are kept, so deleted data can remain in a backup for up to 14 days.\n- Notifications other people received about your actions keep the text they were sent with until they expire (90 days).\n- Messages you sent with the feedback form while signed out cannot be linked to your account; ask through the form to have them deleted.",
		noAccessTitle: "Ask by email, without signing in",
		noAccess:
			"If you can't sign in, email <email>{email}</email> and ask for your account to be deleted. Give your Localman username and the email address of your {idpName} account, so the account can be found. You can also use “Feedback / Contact” at the bottom of this page.",
	},
} as const;
