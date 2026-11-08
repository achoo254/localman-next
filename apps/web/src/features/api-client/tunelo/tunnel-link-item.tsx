import { IconPlugConnected, IconTrash } from "@tabler/icons-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { Switch } from "../../../components/ui/switch";
import { useI18n } from "../../../i18n/i18n-context";
import type { LinkedMachine } from "./tunelo-accounts-api";

export interface TunnelLinkItemProps {
	machine: LinkedMachine;
	revoking: boolean;
	onRevoke: () => void;
	/** `self` machines: turn requests to its localhost on or off. */
	onForwardChange: (enabled: boolean) => void;
	forwardBusy: boolean;
	/** `self` machines: choose a localhost port on it. */
	onPick: () => void;
}

/** One linked machine; the user's own also reach its localhost. */
export function TunnelLinkItem({
	machine,
	revoking,
	onRevoke,
	onForwardChange,
	forwardBusy,
	onPick,
}: TunnelLinkItemProps) {
	const { t, formatDate } = useI18n();
	const name =
		machine.deviceName ?? t("apiClientTunelo.accounts.links.unnamed");
	const own = machine.source === "self";
	const usable = own && !machine.revoked;
	return (
		<li
			data-id="settings-tunelo-link"
			className="grid gap-2 rounded-md border border-border-subtle bg-surface p-2"
		>
			<div className="flex items-center justify-between gap-2">
				<div className="grid min-w-0 gap-0.5">
					<span className="flex items-center gap-2">
						<span className="truncate font-mono text-sm">{name}</span>
						{own ? (
							<Badge data-id="settings-tunelo-link-own">
								{t("apiClientTunelo.accounts.machines.badge")}
							</Badge>
						) : null}
					</span>
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
			</div>
			{usable ? (
				<div className="grid gap-2">
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs">
							{t("apiClientTunelo.accounts.machines.forward", { name })}
						</span>
						<Switch
							checked={machine.forwardEnabled}
							disabled={forwardBusy}
							aria-label={t("apiClientTunelo.accounts.machines.forward", {
								name,
							})}
							data-id="settings-tunelo-link-forward"
							onCheckedChange={onForwardChange}
						/>
					</div>
					<p className="m-0 text-muted text-xs">
						{t("apiClientTunelo.accounts.machines.forwardHint")}
					</p>
					{machine.forwardEnabled ? (
						<div>
							<Button
								size="sm"
								variant="secondary"
								data-id="settings-tunelo-link-pick"
								onClick={onPick}
							>
								<IconPlugConnected size={16} aria-hidden="true" />
								{t("apiClientTunelo.accounts.machines.pick", { name })}
							</Button>
						</div>
					) : null}
				</div>
			) : null}
		</li>
	);
}
