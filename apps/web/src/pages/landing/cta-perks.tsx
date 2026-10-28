import { IconCheck } from "@tabler/icons-react";
import { useT } from "../../i18n/i18n-context";

const PERKS = ["free", "ready", "inBrowser"] as const;

/**
 * "Free · Ready in a minute · Runs in your browser" under the hero, so the
 * cost of trying sits next to the sign-in card.
 */
export function CtaPerks({ "data-id": dataId }: { "data-id": string }) {
	const t = useT();
	return (
		<ul
			data-id={dataId}
			className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-fg text-sm"
		>
			{PERKS.map((perk) => (
				<li key={perk} className="inline-flex items-center gap-1">
					<IconCheck size={16} aria-hidden="true" className="text-primary" />
					{t(`landing.perks.${perk}`)}
				</li>
			))}
		</ul>
	);
}
