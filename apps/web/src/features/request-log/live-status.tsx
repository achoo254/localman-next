import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import type { TrafficSettings } from "../upstream/traffic-settings-api";
import type { LiveState } from "./use-log-stream";

const DOT: Readonly<Record<LiveState, string>> = {
	live: "bg-success",
	paused: "bg-border-strong",
	reconnecting: "bg-warning",
};

/** Live, paused, or lost and retrying; read out when it changes. */
export function LiveStatus({ state }: { state: LiveState }) {
	const t = useT();
	return (
		<output
			data-id="request-log-status"
			data-state={state}
			className="inline-flex items-center gap-1.5 font-mono text-muted text-xs"
		>
			<span
				aria-hidden="true"
				className={cn("size-2 rounded-full", DOT[state])}
			/>
			{t(`trafficLog.status.${state}`)}
		</output>
	);
}

/** How long lines are kept on the owner's plan, what is always masked. */
export function RetentionNote({ settings }: { settings: TrafficSettings }) {
	const t = useT();
	const plan = settings.plan === "pro" ? "Pro" : "Free";
	return (
		<p data-id="request-log-retention" className="m-0 text-muted text-sm">
			{t("trafficLog.retention", { count: settings.logDays, plan })}{" "}
			{renderRich(
				t("trafficLog.alwaysMasked", {
					headers: settings.defaultRedactedHeaders.join(", "),
				}),
			)}{" "}
			{t("trafficLog.replayNote")}
		</p>
	);
}
