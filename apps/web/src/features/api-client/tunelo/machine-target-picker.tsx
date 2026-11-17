import { IconPlugConnected } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { browserTunnelChoices } from "./auto-tunnel";
import { type LinkedMachine, tuneloAccountsApi } from "./tunelo-accounts-api";

export interface MachineTargetPickerProps {
	/** The machine to pick a port on; `null` keeps the picker closed. */
	machine: LinkedMachine | null;
	onClose: () => void;
}

const PORT = /^\d{1,5}$/;

function parsePort(value: string): number | null {
	if (!PORT.test(value.trim())) return null;
	const port = Number(value.trim());
	return port >= 1 && port <= 65_535 ? port : null;
}

/**
 * "localhost:PORT on <machine>": the ports listening on one of the user's
 * own machines (asked through its tunnel), or one typed. The choice is
 * remembered in this browser for `localhost:<port>` like a tunnel picked
 * among several (`auto-tunnel.ts`), and the URL is copied for the tab.
 */
export function MachineTargetPicker({
	machine,
	onClose,
}: MachineTargetPickerProps) {
	const t = useT();
	const toast = useToast();
	const [typed, setTyped] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [busy, setBusy] = useState(false);
	const name = machine?.deviceName ?? "";
	const ports = useQuery({
		queryKey: ["api-client", "machine-ports", machine?.id],
		queryFn: () => tuneloAccountsApi.listMachinePorts(machine?.id ?? ""),
		enabled: machine !== null,
		retry: false,
	});

	const choose = async (port: number) => {
		if (!machine) return;
		setBusy(true);
		try {
			const listed = await tuneloAccountsApi.listTunnels(port, true);
			const entry = listed.find(
				(item) => item.source === "machine" && item.linkId === machine.id,
			);
			if (entry) browserTunnelChoices().set(`localhost:${port}`, entry.url);
			await navigator.clipboard
				?.writeText(`http://localhost:${port}/`)
				.catch(() => undefined);
			toast.show({
				tone: "success",
				title: t("apiClientTunelo.accounts.machines.chosen", { port, name }),
			});
			onClose();
		} catch (caught) {
			toast.show({ tone: "error", title: errorMessage(caught) });
		} finally {
			setBusy(false);
		}
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const port = parsePort(typed);
		if (port === null) {
			setError(t("apiClientTunelo.accounts.machines.invalidPort"));
			return;
		}
		setError(undefined);
		void choose(port);
	};

	const listed = ports.data ?? [];
	return (
		<Modal
			open={machine !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("apiClientTunelo.accounts.machines.pickTitle", { name })}
			size="md"
			data-id="modal-machine-target"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" data-id="modal-machine-target-cancel">
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
				</ModalFooter>
			}
		>
			<div className="grid gap-3 text-sm">
				<p className="m-0 text-muted">
					{t("apiClientTunelo.accounts.machines.pickHint")}
				</p>
				{ports.isPending ? (
					<p className="m-0 text-muted">
						{t("apiClientTunelo.accounts.machines.loading")}
					</p>
				) : listed.length === 0 ? (
					<p data-id="modal-machine-target-empty" className="m-0 text-muted">
						{t("apiClientTunelo.accounts.machines.noPorts")}
					</p>
				) : (
					<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
						{listed.map((item) => (
							<li key={item.port}>
								<Button
									variant="secondary"
									size="sm"
									disabled={busy}
									data-id="modal-machine-target-port"
									onClick={() => void choose(item.port)}
								>
									<IconPlugConnected size={16} aria-hidden="true" />
									<span className="font-mono">
										{item.name ? `${item.port} · ${item.name}` : item.port}
									</span>
								</Button>
							</li>
						))}
					</ul>
				)}
				<form className="flex items-end gap-2" onSubmit={submit}>
					<FormField
						label={t("apiClientTunelo.accounts.machines.portLabel")}
						error={error}
						className="flex-1"
					>
						<Input
							inputMode="numeric"
							value={typed}
							data-id="modal-machine-target-input"
							onChange={(event) => setTyped(event.target.value)}
						/>
					</FormField>
					<Button
						type="submit"
						loading={busy}
						data-id="modal-machine-target-use"
					>
						{t("apiClientTunelo.accounts.machines.use", {
							port: parsePort(typed) ?? "…",
						})}
					</Button>
				</form>
			</div>
		</Modal>
	);
}
