import type { RefObject } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { useWorkspaces } from "../workspaces/current-workspace";
import type { TrashFilters as Filters } from "./trash-api";

export interface TrashFiltersProps {
	filters: Filters;
	text: string;
	deleters: readonly { id: string; name: string | null }[];
	searchRef: RefObject<HTMLInputElement | null>;
	onText: (text: string) => void;
	onChange: (key: keyof Filters, value: string) => void;
}

/** Workspace, who deleted it, and a server search by name. */
export function TrashFilters(props: TrashFiltersProps) {
	const t = useT();
	const workspaces = useWorkspaces().data ?? [];
	return (
		<fieldset
			data-id="trash-filters"
			className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]"
		>
			<legend className="sr-only">
				{t("collections.trash.filters.label")}
			</legend>
			<FormField label={t("collections.trash.search")}>
				<Input
					ref={props.searchRef}
					type="search"
					value={props.text}
					placeholder={t("collections.trash.searchPlaceholder")}
					data-id="trash-search"
					onChange={(event) => props.onText(event.target.value)}
				/>
			</FormField>
			<FormField label={t("collections.trash.filters.workspace")}>
				<Select
					value={props.filters.workspaceId}
					data-id="trash-filter-workspace"
					onChange={(event) =>
						props.onChange("workspaceId", event.target.value)
					}
				>
					<option value="">
						{t("collections.trash.filters.allWorkspaces")}
					</option>
					{workspaces.map((workspace) => (
						<option key={workspace.id} value={workspace.id}>
							{workspace.name}
						</option>
					))}
				</Select>
			</FormField>
			<FormField label={t("collections.trash.filters.deletedBy")}>
				<Select
					value={props.filters.deletedBy}
					data-id="trash-filter-deleted-by"
					onChange={(event) => props.onChange("deletedBy", event.target.value)}
				>
					<option value="">{t("collections.trash.filters.everyone")}</option>
					{props.deleters.map((person) => (
						<option key={person.id} value={person.id}>
							{person.name ?? t("collections.trash.removedAccount")}
						</option>
					))}
				</Select>
			</FormField>
		</fieldset>
	);
}
