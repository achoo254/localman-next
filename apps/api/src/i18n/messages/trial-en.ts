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
 * English texts of the Pro trial (notifications and the owner alert);
 * the source of the shape the other languages fill.
 */
export const trialEn = {
	/** `YYYY-MM-DD` (Asia/Saigon) as a day, e.g. "October 10, 2026". */
	formatDay: (day: string): string => longDate.format(dayAsUtc(day)),
	endingTitle: (p: TrialEndingText): string =>
		`Your Pro trial ends in ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}`,
	endingBody: (p: TrialEndingText): string =>
		`Your Pro trial ends on ${p.date}. Then your account is on Free again: everything you made stays, but creating more above the Free limits is blocked. You can ask for an extension on your account page.`,
	endedTitle: "Your Pro trial has ended",
	endedBody: (p: { readonly date: string }): string =>
		`Your Pro trial ended on ${p.date} and your account is on Free again. Your projects, resources and data are all kept; creating more above the Free limits is blocked. You can ask for an extension on your account page within 7 days.`,
	requestedTitle: "Pro trial extension request",
	requestedBody: (p: { readonly user: string }): string =>
		`${p.user} asked to extend their Pro trial. Approve or decline it on the admin page.`,
	approvedTitle: "Your Pro trial was extended",
	approvedBody: (p: { readonly date: string }): string =>
		`Your Pro trial now runs until ${p.date}.`,
	declinedTitle: "Pro trial extension declined",
	declinedBody:
		"Your request to extend the Pro trial was declined. The trial keeps its current end date.",
	ownerAlert: (p: TrialExtensionAlertText): string =>
		[
			"Pro trial extension request",
			`User: ${p.user}`,
			`Trial ends: ${p.date ?? "no end date"}`,
			"Decide on the admin page: /admin/trial-extensions",
		].join("\n"),
};

export type TrialMessages = typeof trialEn;
