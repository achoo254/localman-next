import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { useUnlockVault, useVaultUi } from "./use-vault-ui";

export interface VaultNoticeProps {
	/** The table has secret variables. */
	hasSecrets: boolean;
	/** Own values of secrets locked in the vault. */
	lockedCount: number;
}

/**
 * Above a variable table with secrets while the vault cannot be read: no
 * vault yet (secrets use their shared value only), or locked (its values
 * are hidden and requests using them stop). Nothing with the flag off.
 */
export function VaultNotice({ hasSecrets, lockedCount }: VaultNoticeProps) {
	const t = useT();
	const status = useVaultUi();
	const unlock = useUnlockVault();
	const none = status === "none";
	if (!(none || status === "locked") || (!hasSecrets && lockedCount === 0)) {
		return null;
	}
	let body = t("agentUse.vault.noneBody");
	if (!none) {
		body =
			lockedCount > 0
				? t("agentUse.vault.lockedBody", { count: lockedCount })
				: t("agentUse.vault.lockedEmpty");
	}
	return (
		<Alert
			tone="info"
			data-id="var-table-vault-notice"
			title={t(
				none ? "agentUse.vault.noneTitle" : "agentUse.vault.lockedTitle",
			)}
		>
			<div className="grid justify-items-start gap-2">
				<span className="text-sm">{body}</span>
				<Button
					size="sm"
					variant="secondary"
					aria-haspopup="dialog"
					data-id={none ? "var-table-vault-create" : "var-table-vault-unlock"}
					onClick={() => unlock()}
				>
					{none ? (
						<IconLock size={14} aria-hidden="true" />
					) : (
						<IconLockOpen size={14} aria-hidden="true" />
					)}
					{t(none ? "agentUse.vault.create" : "agentUse.vault.unlock")}
				</Button>
			</div>
		</Alert>
	);
}
