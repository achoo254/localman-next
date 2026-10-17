import { IconLock, IconPlugConnected } from "@tabler/icons-react";
import { useRef } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import type { TunnelPick } from "../routing/route-types";
import type { LocalTunnel } from "./tunelo-accounts-api";

export interface ChooseTunnelModalProps {
	/** The pending question; `null` keeps the modal closed. */
	pick: TunnelPick | null;
	/** The tunnel picked, or `null` (Cancel, Esc): nothing is sent. */
	onAnswer: (tunnel: LocalTunnel | null) => void;
}

/**
 * Several of the user's tunnels serve the port of a local address: which
 * one gets the request. The choice is remembered for the address in this
 * browser (`auto-tunnel.ts`).
 */
export function ChooseTunnelModal({ pick, onAnswer }: ChooseTunnelModalProps) {
	const t = useT();
	const cancel = useRef<HTMLButtonElement>(null);
	return (
		<Modal
			open={pick !== null}
			onOpenChange={(open) => {
				if (!open) onAnswer(null);
			}}
			title={t("apiClientTunelo.accounts.choose.title", {
				key: pick?.key ?? "",
			})}
			size="md"
			initialFocusRef={cancel}
			data-id="modal-choose-tunnel"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							ref={cancel}
							variant="ghost"
							data-id="modal-choose-tunnel-cancel"
						>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
				</ModalFooter>
			}
		>
			{pick ? (
				<div className="grid gap-3 text-sm">
					<p className="m-0">{t("apiClientTunelo.accounts.choose.body")}</p>
					<ul className="m-0 grid list-none gap-2 p-0">
						{pick.tunnels.map((tunnel) => (
							<li key={tunnel.url}>
								<button
									type="button"
									data-id="modal-choose-tunnel-option"
									className="grid w-full cursor-pointer gap-1 rounded-md border border-border-subtle bg-surface p-3 text-left text-fg hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
									onClick={() => onAnswer(tunnel)}
								>
									<span className="flex items-center gap-2 font-semibold">
										<IconPlugConnected size={16} aria-hidden="true" />
										{tunnel.deviceName}
										{tunnel.basicAuth ? (
											<Badge tone="warning">
												<IconLock size={12} aria-hidden="true" />
												{t("apiClientTunelo.accounts.choose.basicAuth")}
											</Badge>
										) : null}
									</span>
									<span className="break-all font-mono text-muted text-xs">
										{tunnel.url}
									</span>
								</button>
							</li>
						))}
					</ul>
					<p className="m-0 text-muted text-xs">
						{t("apiClientTunelo.accounts.choose.remember")}
					</p>
				</div>
			) : null}
		</Modal>
	);
}
