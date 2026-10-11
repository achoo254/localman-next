import {
	IconHistory,
	IconPlugConnected,
	IconRoute,
	IconStack2,
	IconTrash,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";

export const SIDEBAR_SECTIONS = [
	"collections",
	"history",
	"tunelo",
	"routing",
] as const;
export type SidebarSection = (typeof SIDEBAR_SECTIONS)[number];

export interface SidebarRailProps {
	/** Sections offered, in order (Collections only with the workspaces flag). */
	sections: readonly SidebarSection[];
	/** Section shown in the sidebar (when open). */
	section: SidebarSection;
	open: boolean;
	/** Shows a section, or hides the sidebar when it is the open one. */
	onSelect: (section: SidebarSection) => void;
	/** Id of the sidebar the buttons show and hide. */
	sidebarId: string;
	/** Link to `/trash` at the bottom of the rail. */
	trash?: boolean;
}

const ICONS = {
	collections: IconStack2,
	history: IconHistory,
	tunelo: IconPlugConnected,
	routing: IconRoute,
} as const;

const RAIL_BUTTON =
	"grid min-h-11 min-w-14 cursor-pointer justify-items-center gap-0.5 rounded-sm border-0 px-1 py-1.5 font-semibold text-[0.625rem]";
const IDLE = "bg-transparent text-muted hover:bg-fg/6 hover:text-fg";

/** Narrow strip of sidebar sections: Collections, History, Tunelo, Routing. */
export function SidebarRail({
	sections,
	section,
	open,
	onSelect,
	sidebarId,
	trash = false,
}: SidebarRailProps) {
	const t = useT();
	const labels: Record<SidebarSection, string> = {
		collections: t("collections.rail.collections"),
		history: t("apiClient.sidebar.history"),
		tunelo: t("apiClientTunelo.rail"),
		routing: t("apiClientRouting.rail.routing"),
	};
	return (
		<nav
			aria-label={t("apiClient.sidebar.rail")}
			data-id="sidebar-rail"
			className="flex w-18 flex-none flex-col gap-1 border-border-subtle border-r bg-surface-subtle p-1"
		>
			{sections.map((id) => {
				const Icon = ICONS[id];
				const active = open && section === id;
				return (
					<button
						key={id}
						type="button"
						aria-expanded={active}
						aria-controls={sidebarId}
						data-id={`sidebar-rail-${id}`}
						className={cn(
							RAIL_BUTTON,
							active ? "bg-primary/10 text-primary" : IDLE,
						)}
						onClick={() => onSelect(id)}
					>
						<Icon size={20} aria-hidden="true" />
						{labels[id]}
					</button>
				);
			})}
			{trash ? (
				<Link
					to="/trash"
					data-id="sidebar-rail-trash"
					className={cn(RAIL_BUTTON, IDLE, "mt-auto no-underline")}
				>
					<IconTrash size={20} aria-hidden="true" />
					{t("collections.rail.trash")}
				</Link>
			) : null}
		</nav>
	);
}
