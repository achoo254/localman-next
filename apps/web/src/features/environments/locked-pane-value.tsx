import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { useUnlockVault } from "./use-vault-ui";

/**
 * A value locked in the vault: a send using it stops until unlocked. One
 * sealed by another vault cannot be unlocked: its badge says so.
 */
export function LockedPaneValue({
	name,
	unreadable,
}: { name: string; unreadable: boolean }) {
	const t = useT();
	const unlock = useUnlockVault();
	if (unreadable) {
		return (
			<Badge tone="warning" data-id="vars-quick-unreadable">
				{t("agentUse.vault.unreadableBadge")}
			</Badge>
		);
	}
	return (
		<span className="flex min-w-0 items-center gap-1">
			<Badge tone="warning" data-id="vars-quick-locked">
				{t("agentUse.vault.badge")}
			</Badge>
			<Button
				size="sm"
				variant="ghost"
				aria-haspopup="dialog"
				aria-label={t("agentUse.vault.cell.lockedLabel", { name })}
				data-id="vars-quick-unlock"
				onClick={() => unlock()}
			>
				{t("agentUse.vault.unlock")}
			</Button>
		</span>
	);
}
