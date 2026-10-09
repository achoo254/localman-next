import { localTargetKey, rewriteToTunnel } from "@localman/shared/api-client";
import { IconPlugConnected, IconX } from "@tabler/icons-react";
import { Tooltip } from "../../../components/ui/tooltip";
import { useT } from "../../../i18n/i18n-context";
import { clientSettingsApi } from "../routing/client-settings-api";
import {
	useClientSettings,
	useSettingsChange,
} from "../routing/use-client-settings";

/**
 * In the URL bar of a local URL that has an enabled tunnel mapping:
 * "Via Tunelo", the real URL in a tooltip, and a button removing the
 * mapping. `{{var}}` URLs are skipped (their host is not known yet).
 */
export function TunnelBadge({ url }: { url: string }) {
	const t = useT();
	const { settings } = useClientSettings();
	const remove = useSettingsChange(clientSettingsApi.deleteTunnel);
	const local = url.includes("{{") ? null : localTargetKey(url);
	const mapping = local
		? settings.tunnelMappings.find(
				(item) => item.enabled && item.key === local.key,
			)
		: undefined;
	if (!local || !mapping) return null;
	const real = rewriteToTunnel(url, mapping.url) ?? mapping.url;
	return (
		<span className="mr-1 inline-flex flex-none items-center gap-1 self-center rounded-full border border-info/40 py-0.5 pr-0.5 pl-2 font-mono font-semibold text-info-text text-xs">
			<Tooltip content={t("apiClientTunelo.badge.tip", { url: real })}>
				<span
					data-id="request-url-tunnel-badge"
					className="inline-flex items-center gap-1 rounded-sm"
				>
					<IconPlugConnected size={12} aria-hidden="true" />
					{t("apiClientTunelo.badge.label")}
					<span className="sr-only">
						{t("apiClientTunelo.badge.tip", { url: real })}
					</span>
				</span>
			</Tooltip>
			<button
				type="button"
				aria-label={t("apiClientTunelo.badge.unmap", { key: local.key })}
				data-id="request-url-tunnel-unmap"
				disabled={remove.isPending}
				className="grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-inherit hover:bg-info/15"
				onClick={() => remove.mutate(local.key)}
			>
				<IconX size={12} aria-hidden="true" />
			</button>
		</span>
	);
}
