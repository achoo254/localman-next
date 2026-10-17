import { IconLink, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { useI18n } from "../../../i18n/i18n-context";
import { TuneloConnectModal } from "./tunelo-connect-modal";
import { useRevokeLink, useTunnelLinks } from "./use-tunnel-links";

/**
 * Settings > Tunelo, with the `tuneloAccounts` flag: tunnels of the same
 * Tunelo account are found on their own; machines without an account are
 * linked here (`tunelo link <code>`) and can be revoked.
 */
export function TunnelLinksSection() {
	const { t, formatDate } = useI18n();
	const [connecting, setConnecting] = useState(false);
	const links = useTunnelLinks();
	const revoke = useRevokeLink();
	const machines = links.data ?? [];
	return (
		<section data-id="settings-tunelo-links" className="grid gap-2">
			<h3 className="m-0 font-semibold text-sm">
				{t("apiClientTunelo.accounts.links.title")}
			</h3>
			<p className="m-0 text-muted text-xs">
				{t("apiClientTunelo.accounts.links.hint")}
			</p>
			<div>
				<Button
					data-id="settings-tunelo-link-start"
					onClick={() => setConnecting(true)}
				>
					<IconLink size={16} aria-hidden="true" />
					{t("apiClientTunelo.accounts.links.add")}
				</Button>
			</div>
			{links.isPending ? null : machines.length === 0 ? (
				<p
					data-id="settings-tunelo-links-empty"
					className="m-0 text-muted text-sm"
				>
					{t("apiClientTunelo.accounts.links.empty")}
				</p>
			) : (
				<ul className="m-0 grid list-none gap-2 p-0">
					{machines.map((machine) => {
						const name =
							machine.deviceName ?? t("apiClientTunelo.accounts.links.unnamed");
						return (
							<li
								key={machine.id}
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
									loading={revoke.isPending && revoke.variables === machine.id}
									label={t("apiClientTunelo.accounts.links.revoke", { name })}
									icon={<IconTrash size={16} aria-hidden="true" />}
									data-id="settings-tunelo-link-revoke"
									onClick={() => revoke.mutate(machine.id)}
								/>
							</li>
						);
					})}
				</ul>
			)}
			<TuneloConnectModal open={connecting} onOpenChange={setConnecting} />
		</section>
	);
}
