import { ENVIRONMENT_VARIABLES_MAX } from "@localman/shared/api-client";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { controlClassName } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { copyText } from "../../platform/clipboard";
import type { AgentUseScope } from "../secure-vault/agent-use/agent-use-types";
import type { VariableEditor } from "./use-variable-editor";
import { useVaultUi } from "./use-vault-ui";
import { VariableRow } from "./variable-row";
import { VaultNotice } from "./vault-notice";

const HEAD = "px-1 py-2 text-left font-mono font-semibold text-muted text-xs";

export interface VariableTableProps {
	editor: VariableEditor;
	/** Caption read by screen readers ("Variables of Staging"). */
	caption: string;
	/** "Let agents use" of the scope; `null` while it does not apply. */
	agentUse?: AgentUseScope | null;
}

/**
 * Variables with the caller's local values next to the shared ones, a
 * filter by name, and Add variable for Editors.
 */
export function VariableTable({
	editor,
	caption,
	agentUse = null,
}: VariableTableProps) {
	const t = useT();
	const toast = useToast();
	const vault = useVaultUi();
	const [filter, setFilter] = useState("");
	const query = filter.trim().toLowerCase();
	const rows = query
		? editor.rows.filter((row) =>
				row.variable.key.toLowerCase().includes(query),
			)
		: editor.rows;
	const copy = async (value: string) => {
		const copied = await copyText(value);
		toast.show(
			copied
				? { tone: "success", title: t("environments.table.copied") }
				: { tone: "error", title: t("environments.table.copyFailed") },
		);
	};
	const defined = editor.rows.filter((row) => !row.localOnly).length;
	return (
		<div className="grid gap-3">
			<VaultNotice
				hasSecrets={editor.rows.some((row) => row.variable.type === "secret")}
				lockedCount={editor.rows.filter((row) => row.locked).length}
			/>
			<div className="flex flex-wrap items-center gap-3">
				<label className="relative block w-full max-w-72">
					<span className="sr-only">{t("environments.table.filter")}</span>
					<IconSearch
						size={14}
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-icon-muted"
					/>
					<input
						type="search"
						value={filter}
						placeholder={t("environments.table.filter")}
						data-id="environment-filter"
						className={cn(controlClassName, "min-h-9 pl-8 text-sm")}
						onChange={(e) => setFilter(e.target.value)}
					/>
				</label>
				<p className="m-0 min-w-0 flex-1 text-muted text-xs">
					{t("environments.table.hint")}
				</p>
			</div>
			<div className="overflow-x-auto">
				<table
					data-id="var-table"
					className="w-full min-w-200 border-collapse text-sm"
				>
					<caption className="sr-only">{caption}</caption>
					<thead>
						<tr>
							<th scope="col" className={HEAD}>
								{t("environments.table.name")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.local")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.shared")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.description")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.type")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.enabled")}
							</th>
							<th scope="col" className={HEAD}>
								{t("environments.table.status")}
							</th>
							<th scope="col" className={cn(HEAD, "w-20")}>
								<span className="sr-only">
									{t("environments.table.actions")}
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<VariableRow
								key={row.variable.rowId}
								row={row}
								index={index}
								editor={editor}
								onCopy={(value) => void copy(value)}
								vault={vault}
								agentUse={agentUse}
							/>
						))}
					</tbody>
				</table>
			</div>
			{editor.rows.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("environments.table.empty")}
				</p>
			) : null}
			{editor.duplicates.size > 0 ? (
				<p role="alert" className="m-0 text-error text-xs">
					{t("environments.table.duplicate")}
				</p>
			) : null}
			{editor.canEdit ? (
				<Button
					size="sm"
					className="justify-self-start"
					data-id="var-table-add"
					disabled={defined >= ENVIRONMENT_VARIABLES_MAX}
					onClick={() => {
						setFilter("");
						editor.addVariable();
					}}
				>
					<IconPlus size={16} aria-hidden="true" />
					{t("environments.table.add")}
				</Button>
			) : null}
		</div>
	);
}
