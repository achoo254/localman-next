import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { SyncConflictDialog } from "./sync-conflict-dialog";
import { useSyncStatus } from "./use-live-mock-sync";

export interface SyncConflictBannerProps {
	collectionId: string;
	collectionName: string;
}

/**
 * Above a synced collection while the mock changed fields its user
 * edited; nothing else waits on it. Editors open the choices from here.
 */
export function SyncConflictBanner({
	collectionId,
	collectionName,
}: SyncConflictBannerProps) {
	const t = useT();
	const status = useSyncStatus(collectionId);
	const [open, setOpen] = useState(false);
	const sync = status.data;
	if (!sync || sync.conflicts === 0) return null;
	return (
		<>
			<Alert
				tone="warning"
				data-id="banner-sync-conflict"
				title={t("liveMockSync.banner.title")}
			>
				<div className="flex flex-wrap items-center gap-2">
					<span className="flex-1">
						{t("liveMockSync.banner.count", { count: sync.conflicts })}
					</span>
					{sync.canResolve ? (
						<Button
							size="sm"
							data-id="banner-sync-conflict-resolve"
							onClick={() => setOpen(true)}
						>
							{t("liveMockSync.banner.resolve")}
						</Button>
					) : null}
				</div>
			</Alert>
			{open ? (
				<SyncConflictDialog
					collectionId={collectionId}
					sourceName={sync.project?.name ?? collectionName}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
