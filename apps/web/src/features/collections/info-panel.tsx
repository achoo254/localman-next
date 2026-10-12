import type { CollectionDetail } from "@localman/shared/api-client";
import { IconCopy } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { CollectionMeta } from "./collection-meta";

export interface InfoPanelProps {
	detail: CollectionDetail;
	folderId: string | null;
}

/**
 * ID (with copy), creator, creation date, last update, workspace, requests,
 * related environment and mock project, and the caller's role.
 */
export function InfoPanel({ detail, folderId }: InfoPanelProps) {
	const t = useT();
	const toast = useToast();
	const copy = async () => {
		const ok = await copyText(detail.id);
		toast.show(
			ok
				? { tone: "success", title: t("collections.info.copied") }
				: { tone: "error", title: t("collections.toast.linkFailed") },
		);
	};
	return (
		<div data-id="right-info" className="grid content-start gap-4">
			<div className="grid gap-1">
				<span className="text-muted text-sm">{t("collections.info.id")}</span>
				<div className="flex min-w-0 items-center gap-1">
					<code
						data-id="right-panel-info-id"
						className="min-w-0 flex-1 truncate font-mono text-xs"
					>
						{detail.id}
					</code>
					<IconButton
						size="sm"
						label={t("collections.info.copyId")}
						icon={<IconCopy size={16} aria-hidden="true" />}
						onClick={() => void copy()}
					/>
				</div>
			</div>
			<CollectionMeta detail={detail} folderId={folderId} variant="info" />
		</div>
	);
}
