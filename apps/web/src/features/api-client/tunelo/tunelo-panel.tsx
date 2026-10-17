import { IconPlugConnected, IconRefresh } from "@tabler/icons-react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { clientSettingsApi } from "../routing/client-settings-api";
import {
	useClientSettings,
	useSettingsChange,
} from "../routing/use-client-settings";
import type { TunnelNotice } from "../workbench/workbench-types";
import { CorsHint } from "./cors-hint";
import { tuneloHttpCommand } from "./tunelo-commands";
import { TuneloSteps } from "./tunelo-steps";
import { TunnelPasteForm } from "./tunnel-paste-form";
import { TunnelWarning } from "./tunnel-warning";

export interface TuneloPanelProps {
	/** Local target key (`localhost:3000`) and its port. */
	targetKey: string;
	port: number;
	/** The browser tried the target directly first and was refused. */
	directFailed: boolean;
	/** The user's tunnel for the port stopped, or serves TCP only. */
	notice?: TunnelNotice;
	/** Sends the tab again (after a tunnel was opened or mapped). */
	onResend: () => void;
}

/**
 * In place of a response for a local target the proxy cannot reach: open
 * a tunnel with Tunelo, paste its URL (saved as the user's mapping, then
 * sent again), or enable CORS on the dev server to send directly.
 */
export function TuneloPanel({
	targetKey,
	port,
	directFailed,
	notice,
	onResend,
}: TuneloPanelProps) {
	const t = useT();
	const save = useSettingsChange(clientSettingsApi.setTunnel);
	const { data } = useClientSettings();
	const mapAndResend = (url: string) => {
		save.mutate(
			{ key: targetKey, url, enabled: true },
			{ onSuccess: () => onResend() },
		);
	};
	return (
		<div
			data-id="tunelo-panel"
			className="grid min-h-0 flex-1 content-start gap-4 overflow-auto p-4"
		>
			<h2 className="m-0 flex items-center gap-2 font-bold font-mono text-sm">
				<IconPlugConnected size={18} aria-hidden="true" />
				{t("apiClientTunelo.panel.title")}
			</h2>
			{notice ? (
				<Alert
					tone="warning"
					title={t(`apiClientTunelo.accounts.notice.${notice}`, {
						key: targetKey,
					})}
					data-id={`tunelo-notice-${notice}`}
				>
					<p className="m-0 text-xs">
						{renderRich(
							t(`apiClientTunelo.accounts.notice.${notice}Body`, {
								command: tuneloHttpCommand(port),
							}),
						)}
					</p>
				</Alert>
			) : null}
			{directFailed ? (
				<Alert
					tone="info"
					title={t("apiClientTunelo.panel.directFailed", { key: targetKey })}
					data-id="tunelo-direct-fail"
				>
					<p className="m-0 text-xs">
						{t("apiClientTunelo.panel.directFailedBody")}
					</p>
				</Alert>
			) : null}
			<Alert
				tone="info"
				title={t("apiClientTunelo.panel.reason", { key: targetKey })}
				data-id="tunelo-reason"
			>
				<p className="m-0 text-xs">{t("apiClientTunelo.panel.reasonBody")}</p>
			</Alert>
			<TuneloSteps port={port} />
			<div>
				<Button data-id="tunelo-recheck" onClick={onResend}>
					<IconRefresh size={16} aria-hidden="true" />
					{t("apiClientTunelo.panel.recheck")}
				</Button>
			</div>
			<TunnelPasteForm
				onSubmit={mapAndResend}
				domains={data?.tunnelDomains ?? null}
				busy={save.isPending}
			/>
			<TunnelWarning />
			<CorsHint />
		</div>
	);
}
