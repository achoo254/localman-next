import { IconLock } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { buttonClassName } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export interface WorkspacePlanLimitProps {
	/** Which limit was reached, in a sentence. */
	text: string;
	"data-id": string;
}

/** "Requires Pro" card with a link to the plans, for a reached plan limit. */
export function WorkspacePlanLimit({
	text,
	"data-id": dataId,
}: WorkspacePlanLimitProps) {
	const t = useT();
	return (
		<div
			data-id={dataId}
			className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-subtle p-4"
		>
			<Badge tone="accent">
				<IconLock size={14} aria-hidden="true" />
				{t("workspaces.limit.requiresPro")}
			</Badge>
			<p className="m-0 min-w-0 flex-1 basis-48 text-muted text-sm">{text}</p>
			<Link
				to="/pricing"
				data-id={`${dataId}-plans`}
				className={cn(
					buttonClassName({ variant: "primary", size: "sm" }),
					"no-underline",
				)}
			>
				{t("workspaces.limit.viewPlans")}
			</Link>
		</div>
	);
}
