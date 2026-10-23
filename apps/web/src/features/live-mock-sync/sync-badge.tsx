import type { CollectionDetail } from "@localman/shared/api-client";
import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { SyncSettingsDialog } from "./sync-settings-dialog";
import { useSyncStatus } from "./use-live-mock-sync";

/**
 * "Synced with mock" beside the collection's mock project, for a
 * collection Live Mock Sync keeps up to date; it opens the settings.
 */
export function SyncBadge({ detail }: { detail: CollectionDetail }) {
	const t = useT();
	const status = useSyncStatus(detail.id);
	const [open, setOpen] = useState(false);
	const sync = status.data;
	if (!sync) return null;
	const name = sync.project?.name ?? detail.mockProject?.name ?? detail.name;
	return (
		<>
			<button
				type="button"
				data-id="collection-meta-sync"
				title={t("liveMockSync.badge.title", { name })}
				className="inline-flex min-h-7 w-fit items-center gap-1 rounded-full border border-primary/40 bg-primary/8 px-2 text-primary text-xs hover:bg-primary/14"
				onClick={() => setOpen(true)}
			>
				<IconRefresh size={12} aria-hidden="true" />
				{t("liveMockSync.badge.label")}
			</button>
			{open ? (
				<SyncSettingsDialog
					detail={detail}
					sync={sync}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
