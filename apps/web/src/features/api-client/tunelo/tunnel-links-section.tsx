import { useT } from "../../../i18n/i18n-context";
import { TunnelLinkItem } from "./tunnel-link-item";
import { useRevokeLink, useTunnelLinks } from "./use-tunnel-links";

/**
 * Settings > Tunelo, with the `tuneloAccounts` flag: machines linked with
 * a code before that flow was retired, listed and removable. Nothing links
 * a machine any more (tunnels of the same Tunelo account are found on
 * their own), so the section shows only while one is left.
 */
export function TunnelLinksSection() {
	const t = useT();
	const links = useTunnelLinks();
	const revoke = useRevokeLink();
	const machines = links.data ?? [];
	if (machines.length === 0) return null;
	return (
		<section data-id="settings-tunelo-links" className="grid gap-2">
			<h3 className="m-0 font-semibold text-sm">
				{t("apiClientTunelo.accounts.links.title")}
			</h3>
			<p className="m-0 text-muted text-xs">
				{t("apiClientTunelo.accounts.links.hint")}
			</p>
			<ul className="m-0 grid list-none gap-2 p-0">
				{machines.map((machine) => (
					<TunnelLinkItem
						key={machine.id}
						machine={machine}
						revoking={revoke.isPending && revoke.variables === machine.id}
						onRevoke={() => revoke.mutate(machine.id)}
					/>
				))}
			</ul>
		</section>
	);
}
