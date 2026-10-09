import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface AddToRootRailProps {
	width: number;
	height: number;
	/** The selected resource is nested and may move to the root. */
	active: boolean;
	onClick: () => void;
	"data-id"?: string;
}

/** Vertical "Add to root" bar at the left edge of the canvas. */
export function AddToRootRail({
	width,
	height,
	active,
	onClick,
	"data-id": dataId = "resource-tree-root",
}: AddToRootRailProps) {
	const t = useT();
	return (
		<button
			type="button"
			data-id={dataId}
			data-active={active ? "true" : undefined}
			style={{ width, height }}
			className={cn(
				"absolute top-0 left-0 flex cursor-pointer items-center justify-center rounded-sm border border-dashed p-0",
				"font-mono font-semibold text-[0.6875rem] uppercase tracking-[0.06em]",
				"transition-[border-color,background-color,color]",
				active
					? "border-primary border-solid bg-[color-mix(in_srgb,var(--c-primary)_8%,var(--c-surface))] text-primary"
					: "border-border bg-[color-mix(in_srgb,var(--c-text)_4%,var(--c-surface))] text-muted",
			)}
			onClick={onClick}
		>
			<span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">
				{t("resourceTree.rail.addToRoot")}
			</span>
		</button>
	);
}
