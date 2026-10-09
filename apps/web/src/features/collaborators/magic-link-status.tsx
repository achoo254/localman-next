import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../i18n/i18n-context";
import { DANGER_GHOST } from "./collaborators-footer";
import type { MagicLinkState } from "./magic-link-api";

const HELP = "m-0 text-muted text-[0.8125rem]";

export interface MagicLinkStatusProps {
	link: MagicLinkState;
	onRevoke: () => void;
}

/**
 * State of a link that is no longer shown: active (with "Revoke") or
 * expired; "No active magic link" for none and revoked.
 */
export function MagicLinkStatus({ link, onRevoke }: MagicLinkStatusProps) {
	const { t, formatDate } = useI18n();
	if (link.status === "none" || link.status === "revoked") {
		return <p className={HELP}>{t("collaborators.magic.none")}</p>;
	}
	const active = link.status === "active";
	const expires = link.expiresAt ? formatDate(link.expiresAt) : "";
	return (
		<div
			data-id="modal-magic-link-status"
			className="grid gap-2 rounded-md border border-border-subtle px-3 py-2"
		>
			<div className="flex flex-wrap items-center gap-2 font-mono text-[0.8125rem]">
				{active ? (
					<Badge tone="success">{t("collaborators.magic.active")}</Badge>
				) : (
					<Badge tone="neutral">{t("collaborators.magic.expired")}</Badge>
				)}
				<span>{t("collaborators.magic.expiresOn", { date: expires })}</span>
				{link.createdAt ? (
					<span className="text-muted">
						{t("collaborators.magic.createdOn", {
							date: formatDate(link.createdAt),
						})}
					</span>
				) : null}
			</div>
			{active ? (
				<>
					<p className={HELP}>{t("collaborators.magic.hiddenNote")}</p>
					<Button
						variant="ghost"
						size="sm"
						data-id="modal-magic-link-revoke"
						className={`justify-self-start ${DANGER_GHOST}`}
						onClick={onRevoke}
					>
						{t("collaborators.magic.revoke")}
					</Button>
				</>
			) : null}
		</div>
	);
}
