import { rewriteToTunnel } from "@localman/shared/api-client";
import { IconPlugConnected } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Tooltip } from "../../../components/ui/tooltip";
import { useT } from "../../../i18n/i18n-context";
import {
	TUNNEL_CHOICE_EVENT,
	browserTunnelChoices,
	decideAutoTunnel,
} from "./auto-tunnel";
import { localTunnelsKey } from "./local-tunnels-query";
import { tuneloAccountsApi } from "./tunelo-accounts-api";

function subscribe(onChange: () => void): () => void {
	window.addEventListener(TUNNEL_CHOICE_EVENT, onChange);
	return () => window.removeEventListener(TUNNEL_CHOICE_EVENT, onChange);
}

export interface AutoTunnelBadgeProps {
	url: string;
	/** Local target key (`localhost:3000`) and its port. */
	targetKey: string;
	port: number;
}

/**
 * In the URL bar of a local URL without a mapping, once a send found the
 * user's own tunnel for it: "Via Tunelo · <machine>", the real URL in a
 * tooltip. Reads what the router fetched; never fetches by itself, so
 * typing a URL calls nothing.
 */
export function AutoTunnelBadge({
	url,
	targetKey,
	port,
}: AutoTunnelBadgeProps) {
	const t = useT();
	const { data } = useQuery({
		queryKey: localTunnelsKey(port),
		queryFn: () => tuneloAccountsApi.listTunnels(port, false),
		enabled: false,
	});
	const choices = useMemo(() => browserTunnelChoices(), []);
	const remembered = useSyncExternalStore(
		subscribe,
		useCallback(() => choices.get(targetKey), [choices, targetKey]),
	);
	const decision = data ? decideAutoTunnel(data, remembered) : null;
	if (decision?.kind !== "use") return null;
	const { tunnel } = decision;
	const tip = t("apiClientTunelo.badge.tip", {
		url: rewriteToTunnel(url, tunnel.url) ?? tunnel.url,
	});
	return (
		<span className="mr-1 inline-flex flex-none items-center self-center rounded-full border border-info/40 px-2 py-0.5 font-mono font-semibold text-info-text text-xs">
			<Tooltip content={tip}>
				<span
					data-id="request-url-auto-tunnel-badge"
					className="inline-flex items-center gap-1 rounded-sm"
				>
					<IconPlugConnected size={12} aria-hidden="true" />
					{t("apiClientTunelo.accounts.badge", { device: tunnel.deviceName })}
					<span className="sr-only">{tip}</span>
				</span>
			</Tooltip>
		</span>
	);
}
