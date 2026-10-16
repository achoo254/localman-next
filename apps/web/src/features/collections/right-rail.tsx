import {
	IconGitFork,
	IconGitPullRequest,
	IconHistory,
	IconInfoCircle,
	IconMessageCircle,
	IconX,
} from "@tabler/icons-react";
import { type KeyboardEvent, memo, useId, useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { CommentsPanel } from "../comments/comments-panel";
import { useCommentsEnabled } from "../comments/use-comments-enabled";
import { ForksPanel } from "../version-control/forks-panel";
import { PullRequestsPanel } from "../version-control/pull-requests-panel";
import { useForksEnabled } from "../version-control/use-forks-enabled";
import { ChangelogPanel } from "./changelog-panel";
import { InfoPanel } from "./info-panel";
import { useOpenCollectionNode } from "./open-node";
import {
	RIGHT_PANELS,
	type RightPanel,
	useRightPanel,
} from "./right-panel-context";
import { useRailFocus } from "./right-rail-focus";
import { useCollection } from "./use-collections";
import { useDrawerFocus } from "./use-drawer-focus";

const ICONS = {
	info: IconInfoCircle,
	comments: IconMessageCircle,
	forks: IconGitFork,
	pullRequests: IconGitPullRequest,
	changelog: IconHistory,
} as const;

export interface RightRailProps {
	collectionId: string;
	/** The folder of a folder page (its request count). */
	folderId: string | null;
	/** The folder, example or request shown; `null` on the collection page. */
	nodeId: string | null;
}

/**
 * Right rail of a collection, folder, example or bound request: Info,
 * Comments (the shown item's) and Changelog panels about 340px wide; below 768px the panel is a drawer
 * from the right over a backdrop, which takes the focus while open.
 */
export const RightRail = memo(function RightRail({
	collectionId,
	folderId,
	nodeId,
}: RightRailProps) {
	const t = useT();
	const panelId = useId();
	const { panel, setPanel } = useRightPanel();
	const panelRef = useRef<HTMLElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	useDrawerFocus(panel !== null, () => setPanel(null), panelRef, closeRef);
	const collection = useCollection(collectionId);
	const detail = collection.data;
	const commentsOn = useCommentsEnabled();
	const forksOn = useForksEnabled();
	const openNode = useOpenCollectionNode();
	const panels = RIGHT_PANELS.filter(
		(id) =>
			(commentsOn || id !== "comments") &&
			(forksOn || (id !== "forks" && id !== "pullRequests")),
	);
	useRailFocus(
		{ collectionId, nodeId },
		{ comments: commentsOn, forks: forksOn },
		setPanel,
	);
	const labels: Record<RightPanel, string> = {
		info: t("collections.rightRail.info"),
		comments: t("collections.rightRail.comments"),
		forks: t("collections.rightRail.forks"),
		pullRequests: t("collections.rightRail.pullRequests"),
		changelog: t("collections.rightRail.changelog"),
	};
	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key !== "Escape" || panel === null) return;
		event.stopPropagation();
		setPanel(null);
	};
	return (
		<div className="flex min-h-0 flex-none" onKeyDown={onKeyDown}>
			{panel ? (
				<>
					<button
						type="button"
						tabIndex={-1}
						aria-label={t("collections.rightRail.backdrop")}
						className="fixed inset-x-0 top-(--topbar-h) bottom-0 z-40 cursor-default border-0 bg-backdrop md:hidden"
						onClick={() => setPanel(null)}
					/>
					<aside
						ref={panelRef}
						id={panelId}
						aria-label={labels[panel]}
						data-id={`right-panel-${panel}`}
						className="flex w-85 min-h-0 flex-col border-border-subtle border-l bg-surface max-md:fixed max-md:top-(--topbar-h) max-md:right-0 max-md:bottom-0 max-md:z-50 max-md:max-w-[calc(100vw-3rem)] max-md:shadow-lg"
					>
						<header className="flex items-center gap-2 border-border-subtle border-b py-2 pr-2 pl-3">
							<h2 className="m-0 min-w-0 flex-1 truncate font-bold font-mono text-sm">
								{labels[panel]}
							</h2>
							<IconButton
								ref={closeRef}
								size="sm"
								data-id="right-panel-close"
								label={t("collections.rightRail.close")}
								icon={<IconX size={16} aria-hidden="true" />}
								onClick={() => setPanel(null)}
							/>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto p-3">
							{detail && panel === "info" ? (
								<InfoPanel detail={detail} folderId={folderId} />
							) : null}
							{detail && panel === "comments" && commentsOn ? (
								<CommentsPanel
									collectionId={collectionId}
									nodeId={nodeId}
									workspaceId={detail.workspaceId}
								/>
							) : null}
							{panel === "forks" && forksOn ? (
								<ForksPanel
									target={{ kind: "collection", id: collectionId }}
									onOpen={(forkId, label) =>
										openNode({
											kind: "collection",
											collectionId: forkId,
											name: label,
										})
									}
								/>
							) : null}
							{panel === "pullRequests" && forksOn ? (
								<PullRequestsPanel
									collectionId={collectionId}
									workspaceId={detail?.workspaceId ?? null}
									role={detail?.role ?? null}
								/>
							) : null}
							{panel === "changelog" ? (
								<ChangelogPanel
									collectionId={collectionId}
									canEdit={detail?.role === "editor"}
								/>
							) : null}
						</div>
					</aside>
				</>
			) : null}
			<nav
				aria-label={t("collections.rightRail.label")}
				data-id="right-rail"
				className="flex w-12 flex-none flex-col gap-1 border-border-subtle border-l bg-surface-subtle p-1"
			>
				{panels.map((id) => {
					const Icon = ICONS[id];
					const active = panel === id;
					return (
						<button
							key={id}
							type="button"
							aria-expanded={active}
							aria-controls={active ? panelId : undefined}
							aria-label={labels[id]}
							title={labels[id]}
							data-id={`right-rail-${id}`}
							className={cn(
								"grid min-h-10 cursor-pointer place-items-center rounded-sm border-0",
								active
									? "bg-primary/10 text-primary"
									: "bg-transparent text-muted hover:bg-fg/6 hover:text-fg",
							)}
							onClick={() => setPanel(active ? null : id)}
						>
							<Icon size={20} aria-hidden="true" />
						</button>
					);
				})}
			</nav>
		</div>
	);
});
