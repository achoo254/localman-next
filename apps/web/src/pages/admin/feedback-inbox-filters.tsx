import { CONTACT_STATUSES } from "@localman/shared/constants";
import { FormField } from "../../components/ui/form-field";
import { Select } from "../../components/ui/select";
import { FEEDBACK_CATEGORIES } from "../../features/feedback/feedback-draft";
import { type InboxFilter, isMessageStatus } from "./feedback-inbox-api";
import { STATUS_LABELS } from "./feedback-inbox-item";

export interface FeedbackInboxFiltersProps {
	filter: InboxFilter;
	onChange: (patch: Partial<InboxFilter>) => void;
	countLabel: string;
}

const FIELD = "min-w-0 flex-[1_1_9rem]";

/** Status and category filters above the inbox. */
export function FeedbackInboxFilters({
	filter,
	onChange,
	countLabel,
}: FeedbackInboxFiltersProps) {
	return (
		<div className="flex flex-wrap items-end gap-3 border-border-subtle border-b px-5 py-4">
			<FormField
				label="Trạng thái"
				data-id="admin-feedback-filter-status"
				className={FIELD}
			>
				<Select
					value={filter.status}
					onChange={(event) => {
						const value = event.target.value;
						onChange({ status: isMessageStatus(value) ? value : "" });
					}}
				>
					<option value="">Tất cả</option>
					{CONTACT_STATUSES.map((status) => (
						<option key={status} value={status}>
							{STATUS_LABELS[status].label}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label="Loại"
				data-id="admin-feedback-filter-category"
				className={FIELD}
			>
				<Select
					value={filter.category}
					onChange={(event) => onChange({ category: event.target.value })}
				>
					<option value="">Tất cả</option>
					{FEEDBACK_CATEGORIES.map((choice) => (
						<option key={choice.id} value={choice.id}>
							{choice.label}
						</option>
					))}
				</Select>
			</FormField>
			<span
				data-id="admin-feedback-count"
				className="self-center font-mono text-[0.8125rem] text-muted"
			>
				{countLabel}
			</span>
		</div>
	);
}
