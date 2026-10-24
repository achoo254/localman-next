import { useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { resetVault } from "./vault-session";

/** Typed back to confirm; a command word, the same in every language. */
export const VAULT_RESET_WORD = "reset";

export interface VaultResetDialogProps {
	open: boolean;
	onCancel: () => void;
	/** The vault is gone; `deleted` local values went with it. */
	onReset: (deleted: number) => void;
	onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Reset secret vault": the way out of a forgotten passphrase. Deletes
 * every local value the vault encrypted (and the agent copies) once the
 * word is typed back; shared values stay.
 */
export function VaultResetDialog(props: VaultResetDialogProps) {
	return props.open ? <ResetVaultConfirm {...props} /> : null;
}

function ResetVaultConfirm({
	onCancel,
	onReset,
	onCloseAutoFocus,
}: VaultResetDialogProps) {
	const t = useT();
	const [typed, setTyped] = useState("");
	return (
		<ConfirmModal
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
			title={t("secretVault.reset.title")}
			question={t("secretVault.reset.question")}
			confirmLabel={t("secretVault.reset.submit")}
			confirmDisabled={typed.trim().toLowerCase() !== VAULT_RESET_WORD}
			onConfirm={async () => {
				onReset(await resetVault());
			}}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-vault-reset"
		>
			<p className="m-0">{t("secretVault.reset.body")}</p>
			<p className="m-0">{t("secretVault.reset.agents")}</p>
			<FormField
				label={renderRich(
					t("secretVault.reset.confirmLabel", { word: VAULT_RESET_WORD }),
				)}
				className="mt-2"
			>
				<Input
					value={typed}
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
					data-id="modal-vault-reset-input"
					onChange={(event) => setTyped(event.target.value)}
				/>
			</FormField>
		</ConfirmModal>
	);
}
