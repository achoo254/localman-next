import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { TrafficSettings } from "./traffic-settings-api";
import { TunnelStatus } from "./tunnel-status";
import { MAX_PORT, MIN_PORT, parsePort } from "./upstream-form-state";

export interface UpstreamTunnelFieldsProps {
	/** The port as typed. */
	port: string;
	error: string | undefined;
	onPortChange: (port: string) => void;
	settings: TrafficSettings;
}

/** Port of the "tunnel" choice, whether it has a tunnel, and the 502 note. */
export function UpstreamTunnelFields({
	port,
	error,
	onPortChange,
	settings,
}: UpstreamTunnelFieldsProps) {
	const t = useT();
	const value = parsePort(port);
	const saved = settings.upstream;
	// The server only knows the tunnel of the saved port.
	const tunnelUrl =
		saved.kind === "tunnel" && value === saved.port
			? settings.tunnelUrl
			: undefined;
	return (
		<div className="grid gap-3">
			<FormField label={t("upstream.port.label")} error={error} announceError>
				<Input
					type="number"
					inputMode="numeric"
					min={MIN_PORT}
					max={MAX_PORT}
					value={port}
					onChange={(event) => onPortChange(event.target.value)}
					data-id="project-detail-upstream-port"
				/>
			</FormField>
			{value === null ? null : (
				<TunnelStatus
					port={value}
					url={tunnelUrl}
					scope="project-detail-upstream"
				/>
			)}
			<p className="m-0 text-muted text-sm">
				{renderRich(t("upstream.unavailableNote"))}
			</p>
		</div>
	);
}
