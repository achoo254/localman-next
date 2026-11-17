import { IconTrash } from "@tabler/icons-react";
import { IconButton } from "../../../components/ui/icon-button";
import { useI18n } from "../../../i18n/i18n-context";
import type { LinkedMachine } from "./tunelo-accounts-api";

export interface TunnelLinkItemProps {
	machine: LinkedMachine;
	revoking: boolean;
	onRevoke: () => void;
}

/** One machine linked with a code; only removable. */
export function TunnelLinkItem({
	machine,
	revoking,
	onRevoke,
}: TunnelLinkItemProps) {
	const { t, formatDate } = useI18n();
	const name =
		machine.deviceName ?? t("apiClientTunelo.accounts.links.unnamed");
	return (
		<li
			data-id="settings-tunelo-link"
			className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface p-2"
		>
			<div className="grid min-w-0 gap-0.5">
				<span className="truncate font-mono text-sm">{name}</span>
				{machine.revoked ? (
					<span
						data-id="settings-tunelo-link-revoked"
						className="text-warning-text text-xs"
					>
						{t("apiClientTunelo.accounts.links.revoked")}
					</span>
				) : (
					<span className="text-muted text-xs">
						{t("apiClientTunelo.accounts.links.linkedAt", {
							date: formatDate(machine.linkedAt),
						})}
					</span>
				)}
			</div>
			<IconButton
				size="sm"
				variant="ghost"
				loading={revoking}
				label={t("apiClientTunelo.accounts.links.revoke", { name })}
				icon={<IconTrash size={16} aria-hidden="true" />}
				data-id="settings-tunelo-link-revoke"
				onClick={onRevoke}
			/>
		</li>
	);
}
