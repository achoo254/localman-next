import { IconLink } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { MachineTargetPicker } from "./machine-target-picker";
import type { LinkedMachine } from "./tunelo-accounts-api";
import { TuneloConnectModal } from "./tunelo-connect-modal";
import { TunnelLinkItem } from "./tunnel-link-item";
import {
	useRevokeLink,
	useSetMachineForward,
	useTunnelLinks,
} from "./use-tunnel-links";

/**
 * Settings > Tunelo, with the `tuneloAccounts` flag: tunnels of the same
 * Tunelo account are found on their own; machines without an account are
 * linked here (`tunelo link <code>`) and can be revoked. The user's own
 * machines (linked by `tunelo login`) also take requests for localhost:
 * on/off, and a port picker.
 */
export function TunnelLinksSection() {
	const t = useT();
	const [connecting, setConnecting] = useState(false);
	const [picking, setPicking] = useState<LinkedMachine | null>(null);
	const links = useTunnelLinks();
	const revoke = useRevokeLink();
	const forward = useSetMachineForward();
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
					{machines.map((machine) => (
						<TunnelLinkItem
							key={machine.id}
							machine={machine}
							revoking={revoke.isPending && revoke.variables === machine.id}
							onRevoke={() => revoke.mutate(machine.id)}
							forwardBusy={
								forward.isPending && forward.variables?.id === machine.id
							}
							onForwardChange={(enabled) =>
								forward.mutate({ id: machine.id, enabled })
							}
							onPick={() => setPicking(machine)}
						/>
					))}
				</ul>
			)}
			<TuneloConnectModal open={connecting} onOpenChange={setConnecting} />
			<MachineTargetPicker machine={picking} onClose={() => setPicking(null)} />
		</section>
	);
}
