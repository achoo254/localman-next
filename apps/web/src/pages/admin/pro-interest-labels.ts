import {
	PRICE_HINTS,
	PRO_NEEDS,
	PRO_SOURCES,
	TEAM_SIZES,
	choiceLabel,
} from "../../features/subscription/pro-interest-options";

/** `minhanh@example.com` → `mi***@example.com`; the CSV keeps the full address. */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	if (at < 0) return `${email.slice(0, 2)}***`;
	return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

export const needsLabel = (needs: string[]): string =>
	needs.map((need) => choiceLabel(PRO_NEEDS, need)).join(", ");

export const teamLabel = (teamSize: string): string =>
	teamSize ? choiceLabel(TEAM_SIZES, teamSize) : "—";

export const sourceLabel = (source: string): string =>
	choiceLabel(PRO_SOURCES, source);

export const priceLabel = (priceHint: string): string =>
	choiceLabel(PRICE_HINTS, priceHint);

/** Table cell padding and borders shared by the list and history rows. */
export const CELL =
	"border-border-subtle border-b px-4 py-3 text-left align-middle";
