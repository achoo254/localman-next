import { IconArrowMerge, IconDownload, IconGitFork } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { ForkBadge } from "./fork-badge";
import { ForkDialog } from "./fork-dialog";
import type { ForkTarget } from "./forks-api";
import { SyncDialog } from "./sync-dialog";
import { useForkStatus } from "./use-forks";
import { useForksEnabled } from "./use-forks-enabled";

export interface ForkControlsProps {
	target: ForkTarget;
	name: string;
	role: "editor" | "viewer";
	/** Opens a collection or environment by id (a new fork). */
	onOpen: (id: string) => void;
}

/**
 * Fork (with the number of forks), and on a fork its label, Pull changes
 * and Merge. Hidden while the `forks` flag is off.
 */
export function ForkControls(props: ForkControlsProps) {
	const enabled = useForksEnabled();
	return enabled ? <Controls {...props} /> : null;
}

function Controls({ target, name, role, onOpen }: ForkControlsProps) {
	const t = useT();
	const status = useForkStatus(target);
	const [dialog, setDialog] = useState<"fork" | "pull" | "merge" | null>(null);
	const fork = status.data?.fork ?? null;
	const source =
		fork?.source.available && fork.source.name
			? { id: fork.source.id, name: fork.source.name }
			: null;
	const forkCount = status.data?.forkCount ?? 0;
	return (
		<>
			{fork ? (
				<ForkBadge target={target} fork={fork} canEdit={role === "editor"} />
			) : null}
			{source && role === "editor" ? (
				<Button
					size="sm"
					variant="ghost"
					data-id="fork-pull"
					onClick={() => setDialog("pull")}
				>
					<IconDownload size={16} aria-hidden="true" />
					{t("versionControl.sync.pull")}
				</Button>
			) : null}
			{source ? (
				<Button
					size="sm"
					variant="ghost"
					data-id="fork-merge"
					onClick={() => setDialog("merge")}
				>
					<IconArrowMerge size={16} aria-hidden="true" />
					{t("versionControl.sync.merge")}
				</Button>
			) : null}
			<Button
				size="sm"
				variant="secondary"
				data-id={
					target.kind === "collection"
						? "collection-header-fork"
						: "environment-header-fork"
				}
				title={t("versionControl.fork.count", { count: forkCount })}
				onClick={() => setDialog("fork")}
			>
				<IconGitFork size={16} aria-hidden="true" />
				{t("versionControl.fork.button")}
				{forkCount > 0 ? (
					<span className="text-muted text-xs">{forkCount}</span>
				) : null}
			</Button>
			{dialog === "fork" ? (
				<ForkDialog
					target={target}
					name={name}
					role={role}
					onClose={() => setDialog(null)}
					onForked={onOpen}
				/>
			) : null}
			{(dialog === "pull" || dialog === "merge") && source ? (
				<SyncDialog
					fork={target}
					direction={dialog}
					source={source}
					canEditFork={role === "editor"}
					onClose={() => setDialog(null)}
				/>
			) : null}
		</>
	);
}
