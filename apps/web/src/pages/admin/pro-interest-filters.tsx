import { IconDownload } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import {
	type Choice,
	proNeeds,
	proSources,
} from "../../features/subscription/pro-interest-options";
import { useT } from "../../i18n/i18n-context";
import type { ProInterestFilter } from "./pro-interest-admin-api";

export interface ProInterestFiltersProps {
	filter: ProInterestFilter;
	onChange: (patch: Partial<ProInterestFilter>) => void;
	countLabel: string;
	exporting: boolean;
	onExport: () => void;
}

function FilterSelect({
	id,
	label,
	value,
	choices,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	choices: readonly Choice[];
	onChange: (value: string) => void;
}) {
	const t = useT();
	return (
		<FormField
			label={label}
			data-id={`admin-pro-filter-${id}`}
			className="min-w-0 flex-[1_1_9rem]"
		>
			<Select value={value} onChange={(event) => onChange(event.target.value)}>
				<option value="">{t("common.all")}</option>
				{choices.map((choice) => (
					<option key={choice.id} value={choice.id}>
						{choice.label}
					</option>
				))}
			</Select>
		</FormField>
	);
}

/** Filter toolbar above the sign-up table, with the CSV export. */
export function ProInterestFilters({
	filter,
	onChange,
	countLabel,
	exporting,
	onExport,
}: ProInterestFiltersProps) {
	const t = useT();
	const statuses: readonly Choice[] = [
		{ id: "false", label: t("admin.pro.notContacted") },
		{ id: "true", label: t("admin.pro.contacted") },
	];
	return (
		<div className="flex flex-wrap items-end gap-3 border-border-subtle border-b px-5 py-4">
			<FormField
				label={t("admin.pro.search")}
				data-id="admin-pro-filter-q"
				className="min-w-0 flex-[2_1_12rem]"
			>
				<Input
					type="search"
					value={filter.q}
					onChange={(event) => onChange({ q: event.target.value })}
				/>
			</FormField>
			<FilterSelect
				id="source"
				label={t("admin.pro.source")}
				value={filter.source}
				choices={proSources(t)}
				onChange={(source) => onChange({ source })}
			/>
			<FilterSelect
				id="need"
				label={t("admin.pro.need")}
				value={filter.need}
				choices={proNeeds(t)}
				onChange={(need) => onChange({ need })}
			/>
			<FilterSelect
				id="status"
				label={t("admin.status")}
				value={filter.contacted}
				choices={statuses}
				onChange={(value) =>
					onChange({
						contacted: value === "true" || value === "false" ? value : "",
					})
				}
			/>
			<span
				data-id="admin-pro-count"
				className="self-center font-mono text-[0.8125rem] text-muted"
			>
				{countLabel}
			</span>
			<Button
				data-id="admin-pro-export"
				loading={exporting}
				leadingIcon={<IconDownload size={16} aria-hidden="true" />}
				onClick={onExport}
			>
				{t("admin.pro.exportCsv")}
			</Button>
		</div>
	);
}
