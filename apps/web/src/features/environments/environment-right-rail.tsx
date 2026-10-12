import { IconInfoCircle, IconX } from "@tabler/icons-react";
import { type KeyboardEvent, useId, useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useDrawerFocus } from "../collections/use-drawer-focus";
import { EnvironmentInfoPanel } from "./environment-info-panel";
import { useEnvironment } from "./use-environments";

export interface EnvironmentRightRailProps {
	environmentId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Right rail of an environment page, laid out like a collection's: the
 * Info panel about 340px wide; below 768px a drawer from the right over
 * a backdrop, which takes the focus while open.
 */
export function EnvironmentRightRail({
	environmentId,
	open,
	onOpenChange,
}: EnvironmentRightRailProps) {
	const t = useT();
	const panelId = useId();
	const panelRef = useRef<HTMLElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	useDrawerFocus(open, () => onOpenChange(false), panelRef, closeRef);
	const environment = useEnvironment(environmentId).data;
	const title = t("environments.info.title");
	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key !== "Escape" || !open) return;
		event.stopPropagation();
		onOpenChange(false);
	};
	return (
		<div className="flex min-h-0 flex-none" onKeyDown={onKeyDown}>
			{open ? (
				<>
					<button
						type="button"
						tabIndex={-1}
						aria-label={t("environments.info.close")}
						className="fixed inset-x-0 top-(--topbar-h) bottom-0 z-40 cursor-default border-0 bg-backdrop md:hidden"
						onClick={() => onOpenChange(false)}
					/>
					<aside
						ref={panelRef}
						id={panelId}
						aria-label={title}
						data-id="right-panel-info"
						className="flex w-85 min-h-0 flex-col border-border-subtle border-l bg-surface max-md:fixed max-md:top-(--topbar-h) max-md:right-0 max-md:bottom-0 max-md:z-50 max-md:max-w-[calc(100vw-3rem)] max-md:shadow-lg"
					>
						<header className="flex items-center gap-2 border-border-subtle border-b py-2 pr-2 pl-3">
							<h2 className="m-0 min-w-0 flex-1 truncate font-bold font-mono text-sm">
								{title}
							</h2>
							<IconButton
								ref={closeRef}
								size="sm"
								data-id="right-panel-close"
								label={t("environments.info.close")}
								icon={<IconX size={16} aria-hidden="true" />}
								onClick={() => onOpenChange(false)}
							/>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto p-3">
							{environment ? (
								<EnvironmentInfoPanel environment={environment} />
							) : null}
						</div>
					</aside>
				</>
			) : null}
			<nav
				aria-label={t("environments.info.label")}
				data-id="right-rail"
				className="flex w-12 flex-none flex-col gap-1 border-border-subtle border-l bg-surface-subtle p-1"
			>
				<button
					type="button"
					aria-expanded={open}
					aria-controls={open ? panelId : undefined}
					aria-label={title}
					title={title}
					data-id="right-rail-info"
					className={cn(
						"grid min-h-10 cursor-pointer place-items-center rounded-sm border-0",
						open
							? "bg-primary/10 text-primary"
							: "bg-transparent text-muted hover:bg-fg/6 hover:text-fg",
					)}
					onClick={() => onOpenChange(!open)}
				>
					<IconInfoCircle size={20} aria-hidden="true" />
				</button>
			</nav>
		</div>
	);
}
