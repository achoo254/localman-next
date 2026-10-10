import type { ReactNode } from "react";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/cn";

/** Tinted chip with a tooltip, focusable so keyboard users can read it. */
export function UrlChip({
	tone,
	tip,
	children,
	"data-id": dataId,
}: {
	tone: string;
	tip: string;
	children: ReactNode;
	"data-id": string;
}) {
	return (
		<Tooltip content={tip}>
			<span
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the chip only reveals its tooltip; focus lets keyboard users reach that explanation.
				tabIndex={0}
				data-id={dataId}
				className={cn(
					"tint-soft cursor-help whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-semibold text-(--tone)",
					tone,
				)}
			>
				{children}
			</span>
		</Tooltip>
	);
}
