import {
	COLLECTION_VARIABLES_MAX,
	type VariableEntry,
} from "@localman/shared/api-client";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";

export interface PageVariablesProps {
	/** As stored when the page opened; the table keeps its own rows after. */
	variables: readonly VariableEntry[];
	canEdit: boolean;
	/** Rows with a key (a row being typed has none yet and is not saved). */
	onChange: (variables: VariableEntry[]) => void;
}

const CELL = "border-border-subtle border-b px-1 py-1 align-middle";
const HEAD = "px-1 py-2 text-left font-mono font-semibold text-muted text-xs";
const FIELD = cn(controlClassName, "min-h-9 px-2 text-xs");

/** Collection variables: key, value (hidden when secret), on, secret. */
export function PageVariables(props: PageVariablesProps) {
	const t = useT();
	const { canEdit } = props;
	const [variables, setVariables] = useState(() => [...props.variables]);
	const change = (next: VariableEntry[]) => {
		const saved = (rows: readonly VariableEntry[]) =>
			JSON.stringify(rows.filter((v) => v.key.trim() !== ""));
		setVariables(next);
		if (saved(next) !== saved(variables)) {
			props.onChange(next.filter((v) => v.key.trim() !== ""));
		}
	};
	const set = (index: number, patch: Partial<VariableEntry>) =>
		change(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
	const label = (v: VariableEntry, index: number) =>
		v.key.trim() || t("apiClient.table.rowN", { n: index + 1 });
	return (
		<div className="grid gap-3">
			<p className="m-0 text-muted text-xs">
				{renderRich(
					t("collections.page.variables.hint", { example: "{{baseUrl}}" }),
				)}
			</p>
			<div className="overflow-x-auto">
				<table
					data-id="collection-variables"
					className="w-full min-w-120 border-collapse text-sm"
				>
					<caption className="sr-only">
						{t("collections.page.variables.caption")}
					</caption>
					<thead>
						<tr>
							<th scope="col" className={cn(HEAD, "w-12")}>
								{t("apiClient.table.enabled")}
							</th>
							<th scope="col" className={HEAD}>
								{t("apiClient.table.key")}
							</th>
							<th scope="col" className={HEAD}>
								{t("apiClient.table.value")}
							</th>
							<th scope="col" className={cn(HEAD, "w-16")}>
								{t("collections.page.variables.secret")}
							</th>
							<th scope="col" className={cn(HEAD, "w-10")}>
								<span className="sr-only">{t("apiClient.table.actions")}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{variables.map((v, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: entries have no id; rows are controlled inputs.
							<tr key={index} data-id="collection-variable">
								<td className={CELL}>
									<input
										type="checkbox"
										checked={v.enabled !== false}
										disabled={!canEdit}
										aria-label={t("collections.page.variables.enable", {
											name: label(v, index),
										})}
										className="size-4 accent-(--c-primary)"
										onChange={(e) => set(index, { enabled: e.target.checked })}
									/>
								</td>
								<td className={CELL}>
									<input
										type="text"
										value={v.key}
										readOnly={!canEdit}
										aria-label={t("collections.page.variables.keyOf", {
											n: index + 1,
										})}
										className={FIELD}
										onChange={(e) => set(index, { key: e.target.value })}
									/>
								</td>
								<td className={CELL}>
									<input
										type={v.secret ? "password" : "text"}
										autoComplete="off"
										value={v.value}
										readOnly={!canEdit}
										aria-label={t("collections.page.variables.valueOf", {
											name: label(v, index),
										})}
										className={FIELD}
										onChange={(e) => set(index, { value: e.target.value })}
									/>
								</td>
								<td className={CELL}>
									<input
										type="checkbox"
										checked={v.secret === true}
										disabled={!canEdit}
										aria-label={t("collections.page.variables.markSecret", {
											name: label(v, index),
										})}
										className="size-4 accent-(--c-primary)"
										onChange={(e) => set(index, { secret: e.target.checked })}
									/>
								</td>
								<td className={CELL}>
									{canEdit ? (
										<IconButton
											size="sm"
											label={t("collections.page.variables.remove", {
												name: label(v, index),
											})}
											icon={<IconX size={14} aria-hidden="true" />}
											onClick={() =>
												change(variables.filter((_, i) => i !== index))
											}
										/>
									) : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{variables.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("collections.page.variables.empty")}
				</p>
			) : null}
			{canEdit ? (
				<Button
					size="sm"
					className="justify-self-start"
					data-id="collection-variables-add"
					disabled={variables.length >= COLLECTION_VARIABLES_MAX}
					onClick={() =>
						change([...variables, { key: "", value: "", enabled: true }])
					}
				>
					<IconPlus size={16} aria-hidden="true" />
					{t("collections.page.variables.add")}
				</Button>
			) : null}
		</div>
	);
}
