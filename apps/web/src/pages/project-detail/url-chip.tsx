import { Fragment, type ReactNode } from "react";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/cn";

/**
 * `text` with a line-break opportunity after every `/`, so a long path
 * (`/very/long/prefix/v2`) wraps at its segments rather than mid-word.
 */
export function breakAfterSlashes(text: string): ReactNode {
	const parts = text.split("/");
	return parts.map((part, index) => (
		// Segments are positional and never reorder.
		// biome-ignore lint/suspicious/noArrayIndexKey: split of a fixed string
		<Fragment key={index}>
			{part}
			{index < parts.length - 1 ? (
				<>
					/<wbr />
				</>
			) : null}
		</Fragment>
	));
}

/**
 * Tinted chip with a tooltip, focusable so keyboard users can read it.
 * A `wrap` chip may break over lines (at `<wbr>`, else anywhere) and
 * repeats its border and padding on each line; the others stay on one.
 */
export function UrlChip({
	tone,
	tip,
	wrap = false,
	children,
	"data-id": dataId,
}: {
	tone: string;
	tip: string;
	wrap?: boolean;
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
					"tint-soft cursor-help rounded-sm border px-1.5 py-0.5 font-semibold text-(--tone)",
					wrap ? "box-decoration-clone wrap-anywhere" : "whitespace-nowrap",
					tone,
				)}
			>
				{children}
			</span>
		</Tooltip>
	);
}
