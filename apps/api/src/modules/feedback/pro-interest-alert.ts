import type { Locale, ProInterestSubmission } from "@localman/shared";
import { messagesFor } from "../../i18n/server-messages.js";
import { maskEmail } from "../../lib/mask-email.js";
import type { ProInterestSaveOutcome } from "./pro-interest-store.js";

/** Short Telegram alert for the owner, in `locale`; no name, note or full email. */
export function proInterestAlertText(
	entry: Pick<ProInterestSubmission, "email" | "needs" | "teamSize" | "source">,
	outcome: ProInterestSaveOutcome,
	locale: Locale,
): string {
	const { ownerAlerts } = messagesFor(locale);
	return ownerAlerts.proInterest({
		headline: ownerAlerts.proInterestHeadlines[outcome],
		email: maskEmail(entry.email),
		needs: entry.needs.join(", "),
		teamSize: entry.teamSize,
		source: entry.source,
	});
}
