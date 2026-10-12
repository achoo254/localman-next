import type { Translate } from "../../i18n/translate";
import {
	choiceLabel,
	priceHints,
	proNeeds,
	proSources,
	teamSizes,
} from "./pro-interest-options";

/** `minhanh@example.com` → `mi***@example.com`; the CSV keeps the full address. */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	if (at < 0) return `${email.slice(0, 2)}***`;
	return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

export const needsLabel = (t: Translate, needs: string[]): string =>
	needs.map((need) => choiceLabel(proNeeds(t), need)).join(", ");

export const teamLabel = (t: Translate, teamSize: string): string =>
	teamSize ? choiceLabel(teamSizes(t), teamSize) : "—";

export const sourceLabel = (t: Translate, source: string): string =>
	choiceLabel(proSources(t), source);

export const priceLabel = (t: Translate, priceHint: string): string =>
	choiceLabel(priceHints(t), priceHint);

/** Table cell padding and borders shared by the list and history rows. */
export const CELL =
	"border-border-subtle border-b px-4 py-3 text-left align-middle";
