import { IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { CodeBlock } from "../../../components/ui/code-block";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import { tuneloLinkCommand } from "./tunelo-commands";
import { type PairingView, usePairing } from "./use-pairing";

export interface TuneloConnectModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function PairingBody({
	view,
	onRestart,
}: {
	view: PairingView;
	onRestart: () => void;
}) {
	const t = useT();
	switch (view.step) {
		case "opening":
			return (
				<p className="m-0 text-muted" data-id="tunelo-connect-opening">
					{t("apiClientTunelo.accounts.connect.opening")}
				</p>
			);
		case "waiting":
			return (
				<div className="grid gap-3">
					<p className="m-0">{t("apiClientTunelo.accounts.connect.body")}</p>
					<p
						className="m-0 font-bold font-mono text-2xl tracking-widest"
						data-id="tunelo-connect-code"
					>
						{view.pairing.code}
					</p>
					<CodeBlock
						caption={t("apiClientTunelo.accounts.connect.command")}
						code={tuneloLinkCommand(view.pairing.code)}
						wrap
						data-id="tunelo-connect-command"
					/>
					<p
						className="m-0 text-muted text-xs"
						data-id="tunelo-connect-waiting"
					>
						{t("apiClientTunelo.accounts.connect.waiting")}
					</p>
				</div>
			);
		case "linked":
			return (
				<Alert
					tone="success"
					data-id="tunelo-connect-linked"
					title={
						<span className="inline-flex items-center gap-1">
							<IconCircleCheck size={16} aria-hidden="true" />
							{t("apiClientTunelo.accounts.connect.linked")}
						</span>
					}
				>
					<p className="m-0 text-xs">
						{t("apiClientTunelo.accounts.connect.linkedBody")}
					</p>
				</Alert>
			);
		case "expired":
		case "failed":
			return (
				<div className="grid gap-3">
					<Alert
						tone={view.step === "expired" ? "warning" : "danger"}
						data-id={`tunelo-connect-${view.step}`}
						title={
							view.step === "expired"
								? t("apiClientTunelo.accounts.connect.expired")
								: view.message
						}
					/>
					<div>
						<Button data-id="tunelo-connect-restart" onClick={onRestart}>
							<IconRefresh size={16} aria-hidden="true" />
							{t("apiClientTunelo.accounts.connect.restart")}
						</Button>
					</div>
				</div>
			);
	}
}

/**
 * Links an anonymous machine (no Tunelo account) so Localman sees its
 * tunnels: shows a code to run as `tunelo link <code>` on that machine and
 * waits for it. Closing the modal before then cancels the pairing.
 */
export function TuneloConnectModal({
	open,
	onOpenChange,
}: TuneloConnectModalProps) {
	const t = useT();
	const { view, restart } = usePairing(open);
	const done = view.step === "linked";
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("apiClientTunelo.accounts.connect.title")}
			size="md"
			data-id="modal-tunelo-connect"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							variant={done ? "primary" : "ghost"}
							data-id="modal-tunelo-connect-close"
						>
							{done ? t("common.actions.close") : t("common.actions.cancel")}
						</Button>
					</ModalClose>
				</ModalFooter>
			}
		>
			<div className="text-sm">
				<PairingBody view={view} onRestart={restart} />
			</div>
		</Modal>
	);
}
