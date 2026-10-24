import { useRef } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { AgentUseControl } from "../secure-vault/agent-use/agent-use-control";
import type { AgentUseScope } from "../secure-vault/agent-use/agent-use-types";
import type { VaultStatus } from "../secure-vault/vault-session";
import type { VariableEditor } from "./use-variable-editor";
import { type VariableRow, agentSubjectOf } from "./variable-rows";
import { VaultValueCell, vaultCellState } from "./vault-value-cell";

const MASK = "••••••••";

export interface VariableLocalCellProps {
	row: VariableRow;
	/** The variable's name, or its row for one without a name yet. */
	name: string;
	/** A secret not revealed: shown as dots. */
	hidden: boolean;
	editor: VariableEditor;
	/** `null` with the `secretVault` flag off. */
	vault: VaultStatus | null;
	agentUse: AgentUseScope | null;
	className: string;
	fieldClassName: string;
}

/**
 * The caller's own value of a variable: a box, or the vault action while
 * a secret's value cannot be read or saved; then "Let agents use".
 */
export function VariableLocalCell(props: VariableLocalCellProps) {
	const t = useT();
	const { row, name, hidden, editor, agentUse } = props;
	const { variable } = row;
	const box = useRef<HTMLInputElement>(null);
	const secret = variable.type === "secret";
	const sharedPlaceholder = variable.sharedHidden
		? MASK
		: (variable.sharedValue ?? "");
	const vaultState = vaultCellState(props.vault, {
		secret,
		// Sealed by another vault: unlocking cannot help, a new value can.
		locked: row.locked === true && !row.unreadable,
		hasLocal: row.local !== undefined,
	});
	let placeholder = hidden && sharedPlaceholder ? MASK : sharedPlaceholder;
	if (row.unreadable) placeholder = t("agentUse.vault.unreadable");
	return (
		<td className={props.className}>
			<div className="flex items-center gap-1">
				{vaultState ? (
					<VaultValueCell
						state={vaultState}
						vault={props.vault}
						name={name}
						onOpen={() => requestAnimationFrame(() => box.current?.focus())}
					/>
				) : (
					<input
						ref={box}
						type={hidden ? "password" : "text"}
						autoComplete="off"
						value={row.local ?? ""}
						placeholder={placeholder}
						disabled={row.localKey.trim() === ""}
						aria-label={t("environments.table.localOf", { name })}
						data-id="var-table-value"
						className={cn(props.fieldClassName, "min-w-0 flex-1 font-mono")}
						onChange={(e) =>
							editor.editLocal(
								row.localKey,
								e.target.value === "" ? null : e.target.value,
							)
						}
					/>
				)}
				{secret && agentUse && !row.localOnly && !variable.isNew ? (
					<AgentUseControl scope={agentUse} subject={agentSubjectOf(row)} />
				) : null}
			</div>
		</td>
	);
}
