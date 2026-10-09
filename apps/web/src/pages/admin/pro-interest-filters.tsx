import { IconDownload } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import {
	type Choice,
	PRO_NEEDS,
	PRO_SOURCES,
} from "../../features/subscription/pro-interest-options";
import type { ProInterestFilter } from "./pro-interest-admin-api";

const STATUSES: readonly Choice[] = [
	{ id: "false", label: "Chưa liên hệ" },
	{ id: "true", label: "Đã liên hệ" },
];

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
	return (
		<FormField
			label={label}
			data-id={`admin-pro-filter-${id}`}
			className="min-w-0 flex-[1_1_9rem]"
		>
			<Select value={value} onChange={(event) => onChange(event.target.value)}>
				<option value="">Tất cả</option>
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
	return (
		<div className="flex flex-wrap items-end gap-3 border-border-subtle border-b px-5 py-4">
			<FormField
				label="Tìm email hoặc tên"
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
				label="Nguồn"
				value={filter.source}
				choices={PRO_SOURCES}
				onChange={(source) => onChange({ source })}
			/>
			<FilterSelect
				id="need"
				label="Nhu cầu"
				value={filter.need}
				choices={PRO_NEEDS}
				onChange={(need) => onChange({ need })}
			/>
			<FilterSelect
				id="status"
				label="Trạng thái"
				value={filter.contacted}
				choices={STATUSES}
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
				disabled={exporting}
				leadingIcon={<IconDownload size={16} aria-hidden="true" />}
				onClick={onExport}
			>
				Xuất CSV
			</Button>
		</div>
	);
}
