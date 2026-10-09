import type { KeyValueRow } from "@localman/shared/api-client";
import { IconPlus, IconX } from "@tabler/icons-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { VariableInput } from "./variable-input";

export interface KeyValueTableProps<R extends KeyValueRow> {
	rows: readonly R[];
	onChange: (rows: R[]) => void;
	/** New empty row for "Add". */
	createRow: () => R;
	/** Prefix of every `data-id`: `request-params`, `request-headers`… */
	dataId: string;
	/** `data-id` of the table when it is not `{dataId}-table`. */
	tableDataId?: string;
	/** Name of the table for screen readers ("Params", "Headers"). */
	caption: string;
	addLabel: string;
	/** Description column (hidden on small screens). */
	withDescription?: boolean;
	/** Extra column after Key (form-data's Text/File). */
	typeColumn?: {
		header: string;
		render: (row: R, update: (row: R) => void) => ReactNode;
	};
	/** Replaces the value input (a file picker for file rows). */
	renderValue?: (row: R, update: (row: R) => void) => ReactNode | null;
	/** Rows shown read-only above the editable ones (auto headers). */
	before?: ReactNode;
}

const CELL = "border-border-subtle border-b px-1 py-1 align-middle";

/** Ordered key/value rows with an enable checkbox, as in params and headers. */
export function KeyValueTable<R extends KeyValueRow>(
	props: KeyValueTableProps<R>,
) {
	const { rows, onChange, dataId, withDescription = false } = props;
	const t = useT();
	const table = useRef<HTMLTableElement>(null);
	const focusRow = useRef<string | null>(null);

	useEffect(() => {
		if (!focusRow.current) return;
		const input = table.current?.querySelector<HTMLInputElement>(
			`[data-row="${focusRow.current}"] input[type="text"]`,
		);
		focusRow.current = null;
		input?.focus();
	});

	const update = (next: R) =>
		onChange(rows.map((row) => (row.id === next.id ? next : row)));
	const add = () => {
		const row = props.createRow();
		focusRow.current = row.id;
		onChange([...rows, row]);
	};

	return (
		<div className="grid gap-2">
			<div className="overflow-x-auto">
				<table
					ref={table}
					data-id={props.tableDataId ?? `${dataId}-table`}
					className="w-full min-w-120 border-collapse text-sm"
				>
					<caption className="sr-only">{props.caption}</caption>
					<thead>
						<tr className="text-left text-muted text-xs">
							<th scope="col" className={cn(CELL, "w-10")}>
								<span className="sr-only">{t("apiClient.table.enabled")}</span>
							</th>
							<th scope="col" className={cn(CELL, "font-semibold")}>
								{t("apiClient.table.key")}
							</th>
							{props.typeColumn ? (
								<th scope="col" className={cn(CELL, "w-28 font-semibold")}>
									{props.typeColumn.header}
								</th>
							) : null}
							<th scope="col" className={cn(CELL, "font-semibold")}>
								{t("apiClient.table.value")}
							</th>
							{withDescription ? (
								<th
									scope="col"
									className={cn(CELL, "font-semibold max-md:hidden")}
								>
									{t("apiClient.table.description")}
								</th>
							) : null}
							<th scope="col" className={cn(CELL, "w-10")}>
								<span className="sr-only">{t("apiClient.table.actions")}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{props.before}
						{rows.map((row, index) => {
							const name =
								row.key.trim() || t("apiClient.table.rowN", { n: index + 1 });
							const custom = props.renderValue?.(row, update) ?? null;
							return (
								<tr
									key={row.id}
									data-row={row.id}
									className={row.enabled ? undefined : "text-muted"}
								>
									<td className={cn(CELL, "text-center")}>
										<input
											type="checkbox"
											checked={row.enabled}
											aria-label={t("apiClient.table.enable", { name })}
											className="size-4 accent-primary"
											onChange={(event) =>
												update({ ...row, enabled: event.target.checked })
											}
										/>
									</td>
									<td className={CELL}>
										<VariableInput
											variant="cell"
											value={row.key}
											placeholder={t("apiClient.table.key")}
											aria-label={t("apiClient.table.keyOf", { n: index + 1 })}
											data-id={`${dataId}-key`}
											onValueChange={(key) => update({ ...row, key })}
										/>
									</td>
									{props.typeColumn ? (
										<td className={CELL}>
											{props.typeColumn.render(row, update)}
										</td>
									) : null}
									<td className={CELL}>
										{custom ?? (
											<VariableInput
												variant="cell"
												value={row.value}
												placeholder={t("apiClient.table.value")}
												aria-label={t("apiClient.table.valueOf", { name })}
												data-id={`${dataId}-value`}
												onValueChange={(value) => update({ ...row, value })}
											/>
										)}
									</td>
									{withDescription ? (
										<td className={cn(CELL, "max-md:hidden")}>
											<input
												type="text"
												value={row.description ?? ""}
												placeholder={t("apiClient.table.description")}
												aria-label={t("apiClient.table.descriptionOf", {
													name,
												})}
												className="min-h-9 w-full rounded-sm border border-transparent bg-transparent px-2 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
												onChange={(event) =>
													update({ ...row, description: event.target.value })
												}
											/>
										</td>
									) : null}
									<td className={cn(CELL, "text-center")}>
										<IconButton
											size="sm"
											icon={<IconX size={14} aria-hidden="true" />}
											label={t("apiClient.table.remove", { name })}
											data-id={`${dataId}-delete`}
											onClick={() =>
												onChange(rows.filter((item) => item.id !== row.id))
											}
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<div>
				<Button
					variant="ghost"
					size="sm"
					data-id={`${dataId}-add`}
					onClick={add}
				>
					<IconPlus size={14} aria-hidden="true" />
					{props.addLabel}
				</Button>
			</div>
		</div>
	);
}
