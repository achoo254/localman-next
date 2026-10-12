/** Values of a trial reminder; `date` already formatted for the language. */
export interface TrialEndingText {
	readonly daysLeft: number;
	readonly date: string;
}

/** Owner alert about an extension request; never the user's reason. */
export interface TrialExtensionAlertText {
	readonly user: string;
	/** Formatted end of the current trial, `null` when it has none. */
	readonly date: string | null;
}

const longDate = new Intl.DateTimeFormat("en", {
	dateStyle: "long",
	timeZone: "UTC",
});

/** Parts of a `YYYY-MM-DD` day as a UTC date, for formatting only. */
export function dayAsUtc(day: string): Date {
	const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, date));
}

/**
 * English texts of the 30 days of Pro (notifications and the owner
 * alert); the source of the shape the other languages fill. What users
 * read names no plan, trial or price: the product is not sold yet.
 */
export const trialEn = {
	/** `YYYY-MM-DD` (Asia/Saigon) as a day, e.g. "October 10, 2026". */
	formatDay: (day: string): string => longDate.format(dayAsUtc(day)),
	endingTitle: (p: TrialEndingText): string =>
		`Your extended limits end in ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}`,
	endingBody: (p: TrialEndingText): string =>
		`On ${p.date} your account goes back to the basic limits. Everything you made stays, but creating more above those limits is blocked.`,
	endedTitle: "Your extended limits have ended",
	endedBody: (p: { readonly date: string }): string =>
		`Since ${p.date} your account has the basic limits again. Your projects, resources and data are all kept; creating more above those limits is blocked.`,
	requestedTitle: "Pro trial extension request",
	requestedBody: (p: { readonly user: string }): string =>
		`${p.user} asked to extend their Pro trial. Approve or decline it on the admin page.`,
	approvedTitle: "Your extended limits last longer",
	approvedBody: (p: { readonly date: string }): string =>
		`Your extended limits now run until ${p.date}.`,
	declinedTitle: "Your request was not approved",
	declinedBody:
		"Your request was not approved. Your extended limits keep their current end date.",
	ownerAlert: (p: TrialExtensionAlertText): string =>
		[
			"Pro trial extension request",
			`User: ${p.user}`,
			`Trial ends: ${p.date ?? "no end date"}`,
			"Decide on the admin page: /admin/trial-extensions",
		].join("\n"),
};

export type TrialMessages = typeof trialEn;
