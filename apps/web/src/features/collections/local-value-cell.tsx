import type { VariableEntry } from "@localman/shared/api-client";
import { type ReactNode, useRef, useState } from "react";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useVaultUi } from "../environments/use-vault-ui";
import {
	VaultValueCell,
	vaultCellState,
} from "../environments/vault-value-cell";

export interface LocalValueCellProps {
	entry: VariableEntry;
	/** The variable's name, or its row for one without a key yet. */
	label: string;
	/** The caller's value, `null` when they use the shared one. */
	value: string | null;
	/** The caller's value is locked in the vault. */
	locked: boolean;
	ready: boolean;
	className: string;
	/** `null` (an emptied box) goes back to the shared value. */
	onSave: (value: string | null) => void;
	/** Shown after the box ("Let agents use" of a secret). */
	after?: ReactNode;
}

/**
 * The caller's own value of a collection variable, saved when the box
 * loses focus. Empty means "use the shared value", shown as placeholder
 * unless the variable is secret. Once typing starts the box keeps what is
 * typed (a value the server answers meanwhile shows after it is left).
 * A secret's value the vault keeps out of reach shows the vault action.
 */
export function LocalValueCell(props: LocalValueCellProps) {
	const t = useT();
	const { entry, value } = props;
	const [draft, setDraft] = useState<string | null>(null);
	const box = useRef<HTMLInputElement>(null);
	const key = entry.key.trim();
	const vaultState = vaultCellState(useVaultUi(), {
		secret: entry.secret === true && key !== "",
		locked: props.locked,
		hasLocal: value !== null,
	});
	return (
		<td className={props.className}>
			<div className="flex items-center gap-1">
				{vaultState ? (
					<VaultValueCell
						state={vaultState}
						name={props.label}
						onOpen={() => requestAnimationFrame(() => box.current?.focus())}
					/>
				) : (
					<input
						ref={box}
						type={entry.secret ? "password" : "text"}
						autoComplete="off"
						value={draft ?? value ?? ""}
						placeholder={entry.secret ? undefined : entry.value}
						disabled={!props.ready || key === ""}
						data-id="collection-variable-local"
						aria-label={t("environments.table.localOf", { name: props.label })}
						className={cn(
							controlClassName,
							"min-h-9 min-w-0 flex-1 px-2 text-xs",
						)}
						onChange={(event) => setDraft(event.target.value)}
						onBlur={() => {
							setDraft(null);
							if (draft === null || draft === (value ?? "")) return;
							props.onSave(draft === "" ? null : draft);
						}}
					/>
				)}
				{props.after}
			</div>
		</td>
	);
}
