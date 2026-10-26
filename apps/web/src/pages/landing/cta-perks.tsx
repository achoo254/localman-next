import { IconCheck } from "@tabler/icons-react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const PERKS = ["free", "ready", "inBrowser"] as const;

/**
 * "Free · Ready in a minute · Runs in your browser" next to a sign-up button, so the
 * cost of trying sits where the visitor decides. `inverse` is for the
 * solid primary band (text in `--c-on-primary`).
 */
export function CtaPerks({
	"data-id": dataId,
	inverse = false,
}: {
	"data-id": string;
	inverse?: boolean;
}) {
	const t = useT();
	return (
		<ul
			data-id={dataId}
			className={cn(
				"m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm",
				inverse ? "text-on-primary" : "text-fg",
			)}
		>
			{PERKS.map((perk) => (
				<li key={perk} className="inline-flex items-center gap-1">
					<IconCheck
						size={16}
						aria-hidden="true"
						className={inverse ? undefined : "text-primary"}
					/>
					{t(`landing.perks.${perk}`)}
				</li>
			))}
		</ul>
	);
}
