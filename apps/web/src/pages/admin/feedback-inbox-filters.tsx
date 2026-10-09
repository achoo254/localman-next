import { CONTACT_STATUSES } from "@localman/shared/constants";
import { FormField } from "../../components/ui/form-field";
import { Select } from "../../components/ui/select";
import { FEEDBACK_CATEGORIES } from "../../features/feedback/feedback-draft";
import { useT } from "../../i18n/i18n-context";
import { type InboxFilter, isMessageStatus } from "./feedback-inbox-api";
import { categoryLabel, statusLabel } from "./feedback-inbox-item";

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
	const t = useT();
	return (
		<div className="flex flex-wrap items-end gap-3 border-border-subtle border-b px-5 py-4">
			<FormField
				label={t("admin.status")}
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
					<option value="">{t("common.all")}</option>
					{CONTACT_STATUSES.map((status) => (
						<option key={status} value={status}>
							{statusLabel(t, status)}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={t("admin.inbox.category")}
				data-id="admin-feedback-filter-category"
				className={FIELD}
			>
				<Select
					value={filter.category}
					onChange={(event) => onChange({ category: event.target.value })}
				>
					<option value="">{t("common.all")}</option>
					{FEEDBACK_CATEGORIES.map((choice) => (
						<option key={choice.id} value={choice.id}>
							{categoryLabel(t, choice.id)}
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
