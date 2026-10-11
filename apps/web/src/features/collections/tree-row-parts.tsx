import {
	IconBookmark,
	IconChevronRight,
	IconFolder,
	IconStack2,
	IconStar,
	IconStarFilled,
} from "@tabler/icons-react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../lib/method-tone";
import { type TreeRow, isBranch } from "./tree-rows";

/** Star and ⋯ of a row: 24px, 36px on touch screens. */
export const ROW_BUTTON =
	"grid size-6 flex-none cursor-pointer place-items-center rounded-xs border-0 bg-transparent p-0 text-icon-muted hover:bg-fg/8 hover:text-fg focus-visible:shadow-focus-primary focus-visible:outline-none pointer-coarse:size-9";
/** Shown on hover or focus within the row, always on touch screens. */
export const HOVER_ONLY =
	"opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100";

/** Chevron, then the collection or folder icon or the request's method. */
export function RowLead({ row }: { row: TreeRow }) {
	const icon = "flex-none text-icon-muted";
	return (
		<>
			{isBranch(row) ? (
				<IconChevronRight
					size={14}
					aria-hidden="true"
					className={cn(
						"flex-none text-icon-muted transition-transform duration-(--dur-fast)",
						row.expanded && "rotate-90",
					)}
				/>
			) : (
				<span className="w-3.5 flex-none" aria-hidden="true" />
			)}
			{row.kind === "example" ? (
				<>
					<IconBookmark
						size={14}
						aria-hidden="true"
						className="flex-none text-viz-cyan"
					/>
					<span className="flex-none font-mono text-[0.625rem] text-muted">
						{`${row.node.response.status} · `}
					</span>
				</>
			) : null}
			{row.kind === "collection" ? (
				<IconStack2 size={16} aria-hidden="true" className={icon} />
			) : null}
			{row.kind === "folder" ? (
				<IconFolder size={16} aria-hidden="true" className={icon} />
			) : null}
			{row.kind === "request" ? (
				<span
					className={cn(
						"w-8 flex-none font-bold font-mono text-[0.625rem]",
						METHOD_TEXT_CLASS[row.node.draft.method],
					)}
				>
					{methodShortLabel(row.node.draft.method)}
				</span>
			) : null}
		</>
	);
}

export interface FavoriteButtonProps {
	name: string;
	favorite: boolean;
	tabIndex: 0 | -1;
	onToggle: () => void;
}

/** Star of a collection row (`aria-pressed`); a starred one stays visible. */
export function FavoriteButton({
	name,
	favorite,
	tabIndex,
	onToggle,
}: FavoriteButtonProps) {
	const t = useT();
	return (
		<button
			type="button"
			tabIndex={tabIndex}
			aria-pressed={favorite}
			aria-label={t(
				favorite ? "collections.row.unstar" : "collections.row.star",
				{ name },
			)}
			data-id="sidebar-tree-star"
			className={cn(ROW_BUTTON, favorite ? "text-accent" : HOVER_ONLY)}
			onClick={(event) => {
				event.stopPropagation();
				onToggle();
			}}
		>
			{favorite ? (
				<IconStarFilled size={14} aria-hidden="true" />
			) : (
				<IconStar size={14} aria-hidden="true" />
			)}
		</button>
	);
}
