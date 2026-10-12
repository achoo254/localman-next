import {
	COLLECTION_VARIABLES_MAX,
	type VariableEntry,
} from "@localman/shared/api-client";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";
import { CollectionVariableRow } from "./collection-variable-row";
import { useCollectionLocal } from "./use-collection-local";

export interface PageVariablesProps {
	collectionId: string;
	/** As stored when the page opened; the table keeps its own rows after. */
	variables: readonly VariableEntry[];
	canEdit: boolean;
	/** Rows with a key (a row being typed has none yet and is not saved). */
	onChange: (variables: VariableEntry[]) => void;
}

const HEAD = "px-1 py-2 text-left font-mono font-semibold text-muted text-xs";

/**
 * Collection variables: key, value (hidden when secret), on, secret. With
 * environments on, the caller's own value (any role) beside the shared one.
 */
export function PageVariables(props: PageVariablesProps) {
	const t = useT();
	const { canEdit } = props;
	const localOn = useEnvironmentsEnabled();
	const local = useCollectionLocal(localOn ? props.collectionId : null);
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
	return (
		<div className="grid gap-3">
			<p className="m-0 text-muted text-xs">
				{renderRich(
					t("collections.page.variables.hint", { example: "{{baseUrl}}" }),
				)}
				{localOn ? ` ${t("environments.table.hint")}` : null}
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
							{localOn ? (
								<th scope="col" className={HEAD}>
									{t("environments.table.local")}
								</th>
							) : null}
							<th scope="col" className={HEAD}>
								{t(
									localOn
										? "environments.table.shared"
										: "apiClient.table.value",
								)}
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
							<CollectionVariableRow
								// biome-ignore lint/suspicious/noArrayIndexKey: entries have no id; rows are controlled inputs.
								key={index}
								variable={v}
								index={index}
								canEdit={canEdit}
								local={localOn ? local : null}
								onChange={(patch) => set(index, patch)}
								onRemove={() => change(variables.filter((_, i) => i !== index))}
							/>
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
