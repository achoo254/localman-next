import { IconLockOpen } from "@tabler/icons-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { WrongPassphraseError } from "./vault-crypto";
import { VaultPassphraseField } from "./vault-passphrase-field";
import { unlockWith } from "./vault-session";

export interface VaultUnlockDialogProps {
	open: boolean;
	onCancel: () => void;
	onUnlocked: () => void;
	/** "Forgot passphrase?": hands over to the reset dialog. */
	onForgot: () => void;
	onCloseAutoFocus: (event: Event) => void;
}

/** What went wrong: nothing typed, a wrong passphrase, or anything else. */
type Failure =
	| { kind: "empty" }
	| { kind: "wrong" }
	| { kind: "other"; error: unknown };

/** "Unlock secret vault": one passphrase field, Enter submits. */
export function VaultUnlockDialog(props: VaultUnlockDialogProps) {
	return props.open ? <UnlockVaultForm {...props} /> : null;
}

function UnlockVaultForm({
	onCancel,
	onUnlocked,
	onForgot,
	onCloseAutoFocus,
}: VaultUnlockDialogProps) {
	const t = useT();
	const formId = useId();
	const input = useRef<HTMLInputElement>(null);
	const [passphrase, setPassphrase] = useState("");
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<Failure | null>(null);

	const fail = (next: Failure) => {
		setFailure(next);
		input.current?.focus();
		input.current?.select();
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;
		if (!passphrase) {
			fail({ kind: "empty" });
			return;
		}
		setBusy(true);
		setFailure(null);
		try {
			await unlockWith(passphrase);
			onUnlocked();
		} catch (error) {
			setBusy(false);
			fail(
				error instanceof WrongPassphraseError
					? { kind: "wrong" }
					: { kind: "other", error },
			);
		}
	};

	const fieldError =
		failure?.kind === "empty"
			? t("secretVault.unlock.empty")
			: failure?.kind === "wrong"
				? t("secretVault.unlock.wrong")
				: undefined;

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open && !busy) onCancel();
			}}
			title={t("secretVault.unlock.title")}
			size="sm"
			initialFocusRef={input}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-vault-unlock"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							variant="ghost"
							disabled={busy}
							data-id="modal-vault-unlock-cancel"
						>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						loading={busy}
						leadingIcon={<IconLockOpen size={16} aria-hidden="true" />}
						data-id="modal-vault-unlock-submit"
					>
						{t("secretVault.unlock.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form id={formId} className="grid gap-4" noValidate onSubmit={submit}>
				<p className="m-0 text-muted text-sm">
					{t("secretVault.unlock.intro")}
				</p>
				<VaultPassphraseField
					label={t("secretVault.passphrase.label")}
					value={passphrase}
					onChange={(value) => {
						setPassphrase(value);
						if (failure?.kind !== "other") setFailure(null);
					}}
					autoComplete="current-password"
					error={fieldError}
					announceError
					readOnly={busy}
					inputRef={input}
					data-id="modal-vault-unlock-passphrase"
				/>
				<button
					type="button"
					disabled={busy}
					className="cursor-pointer justify-self-start rounded-sm font-semibold text-primary text-sm underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-45"
					data-id="modal-vault-unlock-forgot"
					onClick={onForgot}
				>
					{t("secretVault.unlock.forgot")}
				</button>
				{busy ? (
					<output className="block text-muted text-sm">
						{t("secretVault.unlock.busy")}
					</output>
				) : null}
				{failure?.kind === "other" ? (
					<Alert tone="danger" data-id="modal-vault-unlock-error">
						{errorMessage(failure.error)}
					</Alert>
				) : null}
			</form>
		</Modal>
	);
}
