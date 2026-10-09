/** Values of an invitation; `inviter` is `null` when the owner has no name. */
export interface InvitationText {
	readonly inviter: string | null;
	readonly project: string;
	readonly days: number;
}

/** Quota warning values, already formatted for the language. */
export interface QuotaText {
	readonly threshold: number;
	readonly used: string;
	readonly limit: string;
	readonly month: string;
}

/** Owner alert about a contact form message; values already safe to send. */
export interface ContactAlertText {
	/** Label from `contactCategories`. */
	readonly category: string;
	readonly excerpt: string;
	/** Masked reply address (`email la***@gm***.com`), `null` when none. */
	readonly contact: string | null;
	readonly signedIn: boolean;
	readonly source: string;
}

/** Owner alert about the Pro interest form; email already masked. */
export interface ProInterestAlertText {
	/** Line from `proInterestHeadlines`. */
	readonly headline: string;
	readonly email: string;
	readonly needs: string;
	readonly teamSize: string;
	readonly source: string;
}

const monthName = new Intl.DateTimeFormat("en", {
	year: "numeric",
	month: "long",
	timeZone: "UTC",
});

/**
 * English server texts: the source of every key and of `ServerMessages`,
 * the shape the other languages must fill (a missing or extra key fails
 * typecheck). Technical terms (mock, project, URL, API) stay in English
 * in every language.
 */
export const en = {
	/** `month` is 1-12; e.g. "October 2026". */
	formatMonth: (year: number, month: number): string =>
		monthName.format(new Date(Date.UTC(year, month - 1, 1))),
	/** Labels of the notification settings page, per event type. */
	eventLabels: {
		"project.invitation": "Project collaboration invitations",
		"project.mockUrlChanged": "A shared project's mock URL changed",
		"usage.quota": "Monthly mock request quota warnings",
	},
	invitation: {
		title: "Project collaboration invitation",
		body: (p: InvitationText): string =>
			`${p.inviter ?? "The project owner"} invited you to collaborate on the project "${p.project}". The invitation expires in ${p.days} ${p.days === 1 ? "day" : "days"}.`,
	},
	mockUrlChanged: {
		title: "Mock URL changed",
		body: (p: { readonly project: string }): string =>
			`The project owner changed the mock URL of the project "${p.project}". The old URL no longer works; use the new URL on the project page.`,
	},
	quota: {
		usedUpTitle: "This month's mock API requests are used up",
		usedUpBody: (p: QuotaText): string =>
			`Your projects have used all ${p.limit} mock API requests of ${p.month}. The mock API returns 429 until the start of next month or until you upgrade to Pro.`,
		warningTitle: (p: QuotaText): string =>
			`You have used ${p.threshold}% of this month's mock API requests`,
		warningBody: (p: QuotaText): string =>
			`Your projects have used ${p.used}/${p.limit} mock API requests of ${p.month}.`,
	},
	ownerAlerts: {
		suppressed: (count: number): string =>
			`(and ${count} more not sent because of the alert limit)`,
		contactCategories: {
			feedback: "Feedback",
			bug: "Bug report",
			plan_question: "Plan question",
		},
		contact: (p: ContactAlertText): string =>
			[
				`New feedback / contact: ${p.category}`,
				`Message: ${p.excerpt}`,
				`Contact: ${p.contact ?? "not provided"}`,
				`Sender: ${p.signedIn ? "signed in" : "guest"}`,
				`Source: ${p.source}`,
			].join("\n"),
		proInterestHeadlines: {
			created: "Pro plan interest: new sign-up",
			updated: "Pro plan interest: updated",
			recorded: "Pro plan interest: sent again by someone else (history only)",
		},
		proInterest: (p: ProInterestAlertText): string =>
			[
				p.headline,
				`Email: ${p.email}`,
				`Needs: ${p.needs}`,
				`Team size: ${p.teamSize}`,
				`Source: ${p.source}`,
			].join("\n"),
	},
};

/** Every language's server texts; a missing or extra key fails typecheck. */
export type ServerMessages = typeof en;
