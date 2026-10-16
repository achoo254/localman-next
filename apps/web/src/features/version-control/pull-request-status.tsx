import type { PullRequestStatus } from "@localman/shared/api-client";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";

const TONES: Record<PullRequestStatus, BadgeTone> = {
	open: "info",
	approved: "success",
	declined: "danger",
	merged: "primary",
};

export function PullRequestStatusBadge({
	status,
}: {
	status: PullRequestStatus;
}) {
	const t = useT();
	return (
		<Badge tone={TONES[status]} data-id="pull-request-status">
			{t(`versionControl.pullRequests.status.${status}`)}
		</Badge>
	);
}
