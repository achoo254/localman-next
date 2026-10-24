import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { type ReactNode, type Ref, useState } from "react";
import { FormField } from "../../components/ui/form-field";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";

export interface VaultPassphraseFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** `new-password` when setting one, `current-password` when unlocking. */
	autoComplete: "new-password" | "current-password";
	error?: ReactNode;
	/** Announce the error at once (it comes back from a check, not typing). */
	announceError?: boolean;
	/** Id of a hint rendered outside the field (e.g. the strength hint). */
	describedBy?: string;
	/** Read-only while the key is derived, so focus can stay in the field. */
	readOnly?: boolean;
	inputRef?: Ref<HTMLInputElement>;
	/** Under the input, e.g. the strength hint. */
	children?: ReactNode;
	"data-id": string;
}

/**
 * Passphrase input with a show/hide toggle. Spellcheck and autocapitalise
 * stay off so the browser never sends or alters what is typed.
 */
export function VaultPassphraseField({
	label,
	value,
	onChange,
	autoComplete,
	error,
	announceError = false,
	describedBy,
	readOnly = false,
	inputRef,
	children,
	"data-id": dataId,
}: VaultPassphraseFieldProps) {
	const t = useT();
	const [shown, setShown] = useState(false);
	return (
		<FormField label={label} error={error} announceError={announceError}>
			<div className="relative">
				<Input
					ref={inputRef}
					type={shown ? "text" : "password"}
					value={value}
					readOnly={readOnly}
					autoComplete={autoComplete}
					autoCapitalize="off"
					autoCorrect="off"
					spellCheck={false}
					aria-describedby={describedBy}
					className="pr-11"
					data-id={dataId}
					onChange={(event) => onChange(event.target.value)}
				/>
				<IconButton
					size="sm"
					label={t(
						shown
							? "secretVault.passphrase.hide"
							: "secretVault.passphrase.show",
					)}
					aria-pressed={shown}
					icon={
						shown ? (
							<IconEyeOff size={16} aria-hidden="true" />
						) : (
							<IconEye size={16} aria-hidden="true" />
						)
					}
					className="absolute inset-y-0 right-1.5 my-auto"
					data-id={`${dataId}-toggle`}
					onClick={() => setShown((value) => !value)}
				/>
			</div>
			{children}
		</FormField>
	);
}
