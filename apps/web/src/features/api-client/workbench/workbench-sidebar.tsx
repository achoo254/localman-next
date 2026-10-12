import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { RoutingSettings } from "../routing/routing-settings";
import { TuneloSidebar } from "../tunelo/tunelo-sidebar";
import {
	SIDEBAR_SECTIONS,
	SidebarRail,
	type SidebarSection,
} from "./sidebar-rail";
import { useSidebarSectionRequests } from "./sidebar-section-request";

export interface WorkbenchSidebarProps {
	/** History section (Tunelo and Routing are built in). */
	history: ReactNode;
	/**
	 * Collections section, first in the rail with a Trash link at its foot;
	 * absent (workspaces flag off) leaves History first.
	 */
	collections?: ReactNode;
	/** Environments section, after Collections; absent (flag off) hides it. */
	environments?: ReactNode;
	/** Id of the drawer, for the menu button that opens it on narrow screens. */
	drawerId: string;
	/** Below 768px rail and sidebar are a drawer over the editor. */
	drawerOpen: boolean;
	onDrawerClose: () => void;
}

/**
 * Rail and sidebar of the workbench: beside the editor from 768px, a drawer
 * from the left with a backdrop below that (opened from the tab bar).
 */
export function WorkbenchSidebar({
	history,
	collections,
	environments,
	drawerId,
	drawerOpen,
	onDrawerClose,
}: WorkbenchSidebarProps) {
	const t = useT();
	// Open beside the editor on wide screens; on narrower ones it would squeeze it.
	const [sidebarOpen, setSidebarOpen] = useState(
		() =>
			typeof window.matchMedia !== "function" ||
			window.matchMedia("(min-width: 64rem)").matches,
	);
	const hasCollections = collections !== undefined;
	const sections: readonly SidebarSection[] = SIDEBAR_SECTIONS.filter(
		(id) =>
			(id !== "collections" || hasCollections) &&
			(id !== "environments" || environments !== undefined),
	);
	const [chosen, setSection] = useState<SidebarSection | null>(null);
	const section =
		chosen !== null && sections.includes(chosen)
			? chosen
			: (sections[0] ?? "history");
	const sidebarId = useId();
	const drawerRef = useRef<HTMLDivElement>(null);

	// The drawer opens on the sidebar, focus on the section it shows.
	useEffect(() => {
		if (!drawerOpen) return;
		setSidebarOpen(true);
		drawerRef.current
			?.querySelector<HTMLButtonElement>('[aria-expanded="true"], button')
			?.focus();
	}, [drawerOpen]);

	const selectSection = (next: SidebarSection) => {
		setSidebarOpen((open) => !(open && next === section));
		setSection(next);
	};
	useSidebarSectionRequests((next) => {
		setSection(next);
		setSidebarOpen(true);
	});
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape" || !drawerOpen) return;
		event.stopPropagation();
		onDrawerClose();
	};

	return (
		<>
			{drawerOpen ? (
				<button
					type="button"
					tabIndex={-1}
					aria-label={t("apiClient.sidebar.close")}
					data-id="sidebar-backdrop"
					className="fixed inset-x-0 top-(--topbar-h) bottom-0 z-40 cursor-default border-0 bg-backdrop md:hidden"
					onClick={onDrawerClose}
				/>
			) : null}
			<div
				ref={drawerRef}
				id={drawerId}
				data-id="sidebar-drawer"
				className={cn(
					"flex min-h-0 flex-none",
					"max-md:fixed max-md:top-(--topbar-h) max-md:bottom-0 max-md:left-0 max-md:z-50 max-md:bg-surface max-md:shadow-lg",
					!drawerOpen && "max-md:hidden",
				)}
				onKeyDown={onKeyDown}
			>
				<SidebarRail
					sections={sections}
					trash={hasCollections}
					section={section}
					open={sidebarOpen}
					sidebarId={sidebarId}
					onSelect={selectSection}
				/>
				<aside
					id={sidebarId}
					hidden={!sidebarOpen}
					aria-label={t("apiClient.sidebar.label")}
					data-id="sidebar"
					data-section={section}
					className={cn(
						"min-h-0 flex-none overflow-y-auto border-border-subtle border-r bg-surface-subtle max-md:max-w-[calc(100vw-5rem)]",
						section === "history" ||
							section === "collections" ||
							section === "environments"
							? "w-72"
							: "w-80",
					)}
				>
					{section === "collections" ? collections : null}
					{section === "environments" ? environments : null}
					{section === "history" ? history : null}
					{section === "tunelo" ? <TuneloSidebar /> : null}
					{section === "routing" ? <RoutingSettings /> : null}
				</aside>
			</div>
		</>
	);
}
