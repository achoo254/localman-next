import { IconGitFork } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useI18n } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import type { ForkTarget } from "./forks-api";
import { useForkList } from "./use-forks";

/** The forks of a collection or environment, newest first. */
export function ForksPanel({
	target,
	onOpen,
}: {
	target: ForkTarget;
	onOpen: (forkId: string, label: string) => void;
}) {
	const { t, formatDate } = useI18n();
	const errorText = useForkErrorMessage();
	const forks = useForkList(target);
	if (forks.isPending) {
		return (
			<SkeletonRegion label={t("versionControl.forks.panel")}>
				<Skeleton className="h-16" />
			</SkeletonRegion>
		);
	}
	if (forks.isError)
		return <Alert tone="danger">{errorText(forks.error)}</Alert>;
	if (forks.data.length === 0) {
		return (
			<p className="m-0 text-muted text-sm">
				{t("versionControl.forks.empty")}
			</p>
		);
	}
	return (
		<ul data-id="forks-list" className="m-0 grid list-none gap-2 p-0">
			{forks.data.map((fork) => (
				<li
					key={fork.forkId}
					data-id="forks-item"
					className="flex items-center gap-2 rounded-md border border-border-subtle p-2"
				>
					<IconGitFork
						size={16}
						aria-hidden="true"
						className="flex-none text-icon-muted"
					/>
					<div className="grid min-w-0 flex-1">
						<span className="truncate font-mono text-sm">{fork.label}</span>
						<span className="text-muted text-xs">
							{t("versionControl.forks.by", {
								person: fork.createdByName ?? "?",
								date: formatDate(fork.createdAt),
							})}
						</span>
					</div>
					<Button
						size="sm"
						variant="ghost"
						disabled={!fork.canOpen}
						title={
							fork.canOpen ? undefined : t("versionControl.forks.noAccess")
						}
						aria-label={t("versionControl.forks.open", { label: fork.label })}
						onClick={() => onOpen(fork.forkId, fork.label)}
					>
						{t("versionControl.forks.openButton")}
					</Button>
				</li>
			))}
		</ul>
	);
}
