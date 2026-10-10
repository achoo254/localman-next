import { IconHistory, IconPlugConnected, IconRoute } from "@tabler/icons-react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";

export const SIDEBAR_SECTIONS = ["history", "tunelo", "routing"] as const;
export type SidebarSection = (typeof SIDEBAR_SECTIONS)[number];

export interface SidebarRailProps {
	/** Section shown in the sidebar (when open). */
	section: SidebarSection;
	open: boolean;
	/** Shows a section, or hides the sidebar when it is the open one. */
	onSelect: (section: SidebarSection) => void;
	/** Id of the sidebar the buttons show and hide. */
	sidebarId: string;
}

const ICONS = {
	history: IconHistory,
	tunelo: IconPlugConnected,
	routing: IconRoute,
} as const;

/** Narrow strip of sidebar sections: History, Tunelo, Routing. */
export function SidebarRail({
	section,
	open,
	onSelect,
	sidebarId,
}: SidebarRailProps) {
	const t = useT();
	const labels: Record<SidebarSection, string> = {
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
			{SIDEBAR_SECTIONS.map((id) => {
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
							"grid min-h-11 min-w-14 cursor-pointer justify-items-center gap-0.5 rounded-sm border-0 px-1 py-1.5 font-semibold text-[0.625rem]",
							active
								? "bg-primary/10 text-primary"
								: "bg-transparent text-muted hover:bg-fg/6 hover:text-fg",
						)}
						onClick={() => onSelect(id)}
					>
						<Icon size={20} aria-hidden="true" />
						{labels[id]}
					</button>
				);
			})}
		</nav>
	);
}
