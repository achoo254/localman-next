import { VARIABLE_TYPES } from "@localman/shared/api-client";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { controlClassName } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { AgentUseScope } from "../secure-vault/agent-use/agent-use-types";
import type { VaultStatus } from "../secure-vault/vault-session";
import type { VariableEditor } from "./use-variable-editor";
import { VariableLocalCell } from "./variable-local-cell";
import { VariableRowMenu } from "./variable-row-menu";
import type { VariableRow as Row } from "./variable-rows";

const CELL = "border-border-subtle border-b px-1 py-1 align-middle";
const FIELD = cn(controlClassName, "min-h-9 min-w-24 px-2 text-xs");

export interface VariableRowProps {
	row: Row;
	index: number;
	editor: VariableEditor;
	onCopy: (value: string) => void;
	/** `null` with the `secretVault` flag off. */
	vault: VaultStatus | null;
	agentUse: AgentUseScope | null;
}

/** One variable: name, local value, shared value, description, type, on, status. */
export function VariableRow(props: VariableRowProps) {
	const { row, index, editor, onCopy, vault, agentUse } = props;
	const t = useT();
	const [revealed, setRevealed] = useState(false);
	const { variable } = row;
	const canEdit = editor.canEdit && !row.localOnly;
	const secret = variable.type === "secret";
	const hidden = secret && !revealed;
	const name =
		variable.key.trim() || t("environments.table.rowN", { n: index + 1 });
	const duplicate = editor.duplicates.has(variable.key.trim());
	// Renaming would strand a locked value, or drop the hosts agents may
	// use it for (the server forgets them with the old name).
	let renameBlocked: string | null = null;
	if (row.locked) renameBlocked = t("agentUse.vault.renameLocked");
	else if (secret && agentUse?.hostsOf(row.localKey) !== undefined) {
		renameBlocked = t("agentUse.control.renameBlocked");
	}
	return (
		<tr data-id="var-table-row" data-key={variable.key}>
			<td className={CELL}>
				<input
					type="text"
					value={variable.key}
					readOnly={!canEdit || renameBlocked !== null}
					aria-label={t("environments.table.nameOf", { n: index + 1 })}
					aria-invalid={duplicate || undefined}
					title={
						duplicate
							? t("environments.table.duplicate")
							: (renameBlocked ?? undefined)
					}
					data-id="var-table-name"
					className={cn(FIELD, "font-mono", duplicate && "border-error")}
					onChange={(e) =>
						editor.editVariable(variable.rowId, { key: e.target.value })
					}
				/>
			</td>
			<VariableLocalCell
				row={row}
				name={name}
				hidden={hidden}
				editor={editor}
				vault={vault}
				agentUse={agentUse}
				className={CELL}
				fieldClassName={FIELD}
			/>
			<td className={CELL}>
				{variable.sharedHidden ? (
					<Badge data-id="var-table-shared" tone="neutral">
						{t("environments.table.hidden")}
					</Badge>
				) : (
					<input
						type={hidden ? "password" : "text"}
						autoComplete="off"
						value={variable.sharedValue ?? ""}
						placeholder={
							variable.sharedValue === null
								? t("environments.table.notShared")
								: ""
						}
						readOnly={!canEdit}
						aria-label={t("environments.table.sharedOf", { name })}
						data-id="var-table-shared"
						className={cn(FIELD, "font-mono")}
						onChange={(e) =>
							editor.editVariable(variable.rowId, {
								sharedValue: e.target.value,
							})
						}
					/>
				)}
			</td>
			<td className={CELL}>
				<input
					type="text"
					value={variable.description}
					readOnly={!canEdit}
					aria-label={t("environments.table.descriptionOf", { name })}
					data-id="var-table-desc"
					className={FIELD}
					onChange={(e) =>
						editor.editVariable(variable.rowId, {
							description: e.target.value,
						})
					}
				/>
			</td>
			<td className={CELL}>
				<select
					value={variable.type}
					disabled={!canEdit}
					aria-label={t("environments.table.typeOf", { name })}
					data-id="var-table-type"
					className={cn(FIELD, "min-w-20")}
					onChange={(e) => {
						const type = VARIABLE_TYPES.find((item) => item === e.target.value);
						if (type) editor.editVariable(variable.rowId, { type });
					}}
				>
					{VARIABLE_TYPES.map((type) => (
						<option key={type} value={type}>
							{t(`environments.table.types.${type}`)}
						</option>
					))}
				</select>
			</td>
			<td className={CELL}>
				<Switch
					checked={variable.enabled}
					disabled={!canEdit}
					aria-label={t("environments.table.enabledOf", { name })}
					data-id="var-table-enabled"
					onCheckedChange={(enabled) =>
						editor.editVariable(variable.rowId, { enabled })
					}
				/>
			</td>
			<td className={CELL}>
				<Badge
					data-id="var-table-status"
					tone={row.sync === "edited" ? "warning" : "neutral"}
				>
					{t(`environments.table.sync.${row.sync}`)}
				</Badge>
			</td>
			<td className={cn(CELL, "whitespace-nowrap")}>
				{secret ? (
					<IconButton
						size="sm"
						variant="ghost"
						data-id="var-table-reveal"
						aria-pressed={revealed}
						label={t(
							revealed
								? "environments.table.hide"
								: "environments.table.reveal",
							{ name },
						)}
						icon={
							revealed ? (
								<IconEyeOff size={16} aria-hidden="true" />
							) : (
								<IconEye size={16} aria-hidden="true" />
							)
						}
						onClick={() => setRevealed((value) => !value)}
					/>
				) : null}
				<VariableRowMenu
					row={row}
					canEdit={editor.canEdit}
					label={name}
					vault={vault}
					agentUse={secret && !variable.isNew ? agentUse : null}
					onShare={() => editor.shareRows([row])}
					onReset={() => editor.resetRows([row])}
					onUnshare={() => editor.unshareRows([row])}
					onCopy={onCopy}
					onDelete={() => editor.removeVariable(variable.rowId)}
				/>
			</td>
		</tr>
	);
}
