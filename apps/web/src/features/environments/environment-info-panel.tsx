import type { EnvironmentDetail } from "@localman/shared/api-client";
import { IconCopy } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { EnvironmentUsage } from "./environment-usage";
import { useActiveEnvironment } from "./use-environments";

/** ID (with copy), who made it and when, last update, active for you. */
export function EnvironmentInfoPanel({
	environment,
}: {
	environment: EnvironmentDetail;
}) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const active = useActiveEnvironment(environment.workspaceId);
	const isActive = active.data?.environmentId === environment.id;
	const copy = async () => {
		const ok = await copyText(environment.id);
		toast.show(
			ok
				? { tone: "success", title: t("environments.info.copied") }
				: { tone: "error", title: t("environments.table.copyFailed") },
		);
	};
	return (
		<div className="grid content-start gap-4">
			<div className="grid gap-1">
				<span className="text-muted text-sm">{t("environments.info.id")}</span>
				<div className="flex min-w-0 items-center gap-1">
					<code
						data-id="right-panel-info-id"
						className="min-w-0 flex-1 truncate font-mono text-xs"
					>
						{environment.id}
					</code>
					<IconButton
						size="sm"
						data-id="right-panel-info-copy"
						label={t("environments.info.copyId")}
						icon={<IconCopy size={16} aria-hidden="true" />}
						onClick={() => void copy()}
					/>
				</div>
			</div>
			<dl
				data-id="environment-meta"
				className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"
			>
				<dt className="text-muted">{t("environments.info.createdBy")}</dt>
				<dd className="m-0 truncate" data-id="environment-created-by">
					{environment.createdByName ?? t("environments.info.someone")}
				</dd>
				<dt className="text-muted">{t("environments.info.createdAt")}</dt>
				<dd className="m-0" data-id="environment-created-at">
					{formatDate(environment.createdAt)}
				</dd>
				<dt className="text-muted">{t("environments.info.updatedAt")}</dt>
				<dd className="m-0" data-id="environment-updated-at">
					{formatDate(environment.updatedAt)}
				</dd>
				<dt className="text-muted">{t("environments.info.activeForYou")}</dt>
				<dd className="m-0" data-id="environment-active-for-you">
					{active.data
						? t(isActive ? "environments.info.yes" : "environments.info.no")
						: t("environments.info.unknown")}
				</dd>
			</dl>
			<EnvironmentUsage environmentId={environment.id} />
		</div>
	);
}
