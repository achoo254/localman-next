import type { TrialExtensionStatus } from "@localman/shared/constants";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../i18n/i18n-context";
import {
	type TrialExtensionItem as Item,
	requesterLabel,
} from "./trial-extensions-api";

const STATUS_TONES: Readonly<Record<TrialExtensionStatus, BadgeTone>> = {
	pending: "accent",
	approved: "success",
	declined: "neutral",
};

export interface TrialExtensionItemProps {
	item: Item;
	onDecide: (item: Item, decision: "approve" | "decline") => void;
}

/** One request: who, when, the reason, and the decision buttons while pending. */
export function TrialExtensionItem({
	item,
	onDecide,
}: TrialExtensionItemProps) {
	const { t, formatDate } = useI18n();
	const prefix = `admin-trial-item-${item.id}`;
	const meta = [
		item.user.username ? `@${item.user.username}` : null,
		item.user.sub,
		t("admin.trial.requested", { date: formatDate(item.requestedAt) }),
		item.trialEndsAt
			? t("admin.trial.trialEnds", { date: formatDate(item.trialEndsAt) })
			: null,
	].filter((part): part is string => part !== null);
	const user = requesterLabel(item);
	return (
		<li
			data-id={prefix}
			className="grid gap-2 border-border-subtle border-b px-5 py-4 last:border-b-0"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="m-0 font-bold font-mono text-sm">{user}</h2>
				<Badge tone={STATUS_TONES[item.status]} data-id={`${prefix}-status`}>
					{t(`admin.trial.statuses.${item.status}`)}
				</Badge>
			</div>
			<p className="m-0 break-all font-mono text-[0.8125rem] text-muted">
				{meta.join(" · ")}
			</p>
			<p
				data-id={`${prefix}-reason`}
				className="m-0 whitespace-pre-wrap break-words border-border border-l-2 pl-3 text-sm"
			>
				<span className="sr-only">{`${t("admin.trial.reason")}: `}</span>
				{item.reason}
			</p>
			{item.status === "pending" ? (
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						size="sm"
						data-id={`${prefix}-decline`}
						aria-label={t("admin.trial.declineFor", { user })}
						onClick={() => onDecide(item, "decline")}
					>
						{t("admin.trial.decline")}
					</Button>
					<Button
						size="sm"
						variant="primary"
						data-id={`${prefix}-approve`}
						aria-label={t("admin.trial.approveFor", { user })}
						onClick={() => onDecide(item, "approve")}
					>
						{t("admin.trial.approve")}
					</Button>
				</div>
			) : null}
		</li>
	);
}
