import { Badge, type BadgeTone } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import type { LogSource, LogSummary } from "./request-log-parse";

/** Answered by the mock (or one of its rules), forwarded, caught, sent out. */
const TONES: Readonly<Record<LogSource, BadgeTone>> = {
	mock: "primary",
	rule: "primary",
	upstream: "neutral",
	inbox: "info",
	callback: "accent",
};

export interface SourceBadgeProps {
	row: Pick<LogSummary, "source" | "inbox" | "event">;
}

/**
 * Where a logged request was answered, with the inbox name or callback
 * event when there is one. Never a path or URL: badges are upper case.
 */
export function SourceBadge({ row }: SourceBadgeProps) {
	const t = useT();
	const source = t(`trafficLog.sources.${row.source}`);
	const detail =
		row.source === "inbox"
			? row.inbox
			: row.source === "callback"
				? row.event
				: null;
	return (
		<Badge tone={TONES[row.source]}>
			{detail ? t("trafficLog.sourceWith", { source, detail }) : source}
		</Badge>
	);
}
