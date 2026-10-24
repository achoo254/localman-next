import { IconLock } from "@tabler/icons-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { VaultPassphraseField } from "./vault-passphrase-field";
import {
	PassphraseStrengthHint,
	isAcceptablePassphrase,
	passphraseStrength,
} from "./vault-passphrase-strength";
import { createNewVault } from "./vault-session";

export interface VaultCreateDialogProps {
	open: boolean;
	/** Right after a reset: another title and a note that the old one went. */
	afterReset: boolean;
	onCancel: () => void;
	onCreated: () => void;
	onCloseAutoFocus: (event: Event) => void;
}

/** "Create secret vault": passphrase twice, the no-recovery warning. */
export function VaultCreateDialog(props: VaultCreateDialogProps) {
	return props.open ? <CreateVaultForm {...props} /> : null;
}

/**
 * Only a typed-in prefix of the passphrase is not a mismatch yet: the
 * error waits until the second entry really goes another way.
 */
function confirmsWrongly(passphrase: string, confirm: string): boolean {
	return confirm !== "" && !passphrase.startsWith(confirm);
}

function CreateVaultForm({
	afterReset,
	onCancel,
	onCreated,
	onCloseAutoFocus,
}: VaultCreateDialogProps) {
	const t = useT();
	const formId = useId();
	const strengthId = useId();
	const first = useRef<HTMLInputElement>(null);
	const [passphrase, setPassphrase] = useState("");
	const [confirm, setConfirm] = useState("");
	const [acknowledged, setAcknowledged] = useState(false);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<unknown>(null);

	const strength = passphraseStrength(passphrase);
	const valid =
		isAcceptablePassphrase(strength) && confirm === passphrase && acknowledged;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!valid || busy) return;
		setBusy(true);
		setFailure(null);
		try {
			await createNewVault(passphrase);
			onCreated();
		} catch (error) {
			setFailure(error);
			setBusy(false);
		}
	};

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open && !busy) onCancel();
			}}
			title={t(
				afterReset
					? "secretVault.create.titleAfterReset"
					: "secretVault.create.title",
			)}
			size="md"
			initialFocusRef={first}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-vault-create"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							variant="ghost"
							disabled={busy}
							data-id="modal-vault-create-cancel"
						>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={!valid}
						loading={busy}
						leadingIcon={<IconLock size={16} aria-hidden="true" />}
						data-id="modal-vault-create-submit"
					>
						{t("secretVault.create.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form id={formId} className="grid gap-4" noValidate onSubmit={submit}>
				{afterReset ? (
					<Alert tone="info" data-id="modal-vault-create-reason">
						{t("secretVault.create.afterReset")}
					</Alert>
				) : null}
				<p className="m-0 text-muted text-sm">
					{t("secretVault.create.intro")}
				</p>
				<VaultPassphraseField
					label={t("secretVault.passphrase.label")}
					value={passphrase}
					onChange={setPassphrase}
					autoComplete="new-password"
					describedBy={strengthId}
					readOnly={busy}
					inputRef={first}
					data-id="modal-vault-create-passphrase"
				>
					<PassphraseStrengthHint strength={strength} id={strengthId} />
					<p className="m-0 text-[0.8125rem] text-muted leading-normal">
						{t("secretVault.create.tip")}
					</p>
				</VaultPassphraseField>
				<VaultPassphraseField
					label={t("secretVault.create.confirm")}
					value={confirm}
					onChange={setConfirm}
					autoComplete="new-password"
					error={
						confirmsWrongly(passphrase, confirm)
							? t("secretVault.create.mismatch")
							: undefined
					}
					announceError
					readOnly={busy}
					data-id="modal-vault-create-confirm"
				/>
				<Alert
					tone="warning"
					title={t("secretVault.create.warningTitle")}
					data-id="modal-vault-create-warning"
				>
					{t("secretVault.create.warningBody")}
				</Alert>
				<label className="flex items-start gap-3 text-sm">
					<input
						type="checkbox"
						checked={acknowledged}
						disabled={busy}
						required
						className="mt-0.5 size-4 shrink-0 accent-primary"
						data-id="modal-vault-create-ack"
						onChange={(event) => setAcknowledged(event.target.checked)}
					/>
					{t("secretVault.create.ack")}
				</label>
				{busy ? (
					<output className="block text-muted text-sm">
						{t("secretVault.create.busy")}
					</output>
				) : null}
				{failure ? (
					<Alert tone="danger" data-id="modal-vault-create-error">
						{errorMessage(failure)}
					</Alert>
				) : null}
			</form>
		</Modal>
	);
}
