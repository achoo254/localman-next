import { IconExternalLink } from "@tabler/icons-react";
import { useState } from "react";
import { tenantDomainOfIdp } from "../../../components/layout/ecosystem-app-switcher";
import { ExternalLink } from "../../../components/ui/external-link";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { useTenantInfo } from "../../../lib/tenant-info";
import { MachineTargetPicker } from "./machine-target-picker";
import type { LinkedMachine } from "./tunelo-accounts-api";
import { chatAddMachineUrl, tuneloLoginCommand } from "./tunelo-commands";
import { TunnelLinkItem } from "./tunnel-link-item";
import {
	useRevokeLink,
	useSetMachineForward,
	useTunnelLinks,
} from "./use-tunnel-links";

/** How a machine joins: Chat's one-line install, then `tunelo login`. */
function AddMachineGuide() {
	const t = useT();
	const { idpOrigin, tunnelDomain } = useTenantInfo();
	const tenantDomain = tenantDomainOfIdp(idpOrigin);
	return (
		<div data-id="settings-tunelo-add-guide" className="grid gap-1">
			<p className="m-0 text-xs">
				{renderRich(
					t("apiClientTunelo.accounts.links.addSteps", {
						command: tuneloLoginCommand(tunnelDomain),
					}),
				)}
			</p>
			{tenantDomain === null ? null : (
				<ExternalLink
					href={chatAddMachineUrl(tenantDomain)}
					data-id="settings-tunelo-add-chat"
					className="inline-flex items-center gap-1 text-primary text-xs"
				>
					{t("apiClientTunelo.accounts.links.openChat")}
					<IconExternalLink size={14} aria-hidden="true" />
					<span className="sr-only">{` ${t("common.opensInNewTab")}`}</span>
				</ExternalLink>
			)}
		</div>
	);
}

/**
 * Settings > Tunelo, with the `tuneloAccounts` flag: tunnels of the same
 * Tunelo account are found on their own, and each machine signed in with
 * `tunelo login` links itself and is listed here, revocable. The user's
 * own machines also take requests for localhost: on/off, and a port
 * picker. Machines linked with a code before that flow was retired are
 * still listed and removable.
 */
export function TunnelLinksSection() {
	const t = useT();
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
			<AddMachineGuide />
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
			<MachineTargetPicker machine={picking} onClose={() => setPicking(null)} />
		</section>
	);
}
