import { useT } from "../../i18n/i18n-context";
import type { ProInterestItem } from "./pro-interest-item";
import { ProInterestRow } from "./pro-interest-row";

export interface ProInterestTableProps {
	items: ProInterestItem[];
	/** Row id whose "contacted" change is in flight. */
	onToggleContacted: (item: ProInterestItem) => void;
	onDelete: (item: ProInterestItem) => void;
}

const HEAD =
	"whitespace-nowrap border-border border-b px-4 py-3 text-left align-middle font-bold font-mono text-muted text-xs";

export function ProInterestTable({
	items,
	onToggleContacted,
	onDelete,
}: ProInterestTableProps) {
	const t = useT();
	const headers = [
		"Email",
		t("admin.pro.need"),
		t("admin.pro.teamSize"),
		t("admin.pro.source"),
		t("admin.pro.date"),
		t("admin.status"),
	];
	return (
		<div className="relative overflow-x-auto" data-id="admin-pro-table-scroll">
			<table
				data-id="admin-pro-table"
				className="w-full min-w-205 border-collapse text-sm"
			>
				<caption className="sr-only">{t("admin.pro.tableCaption")}</caption>
				<thead>
					<tr>
						{headers.map((header) => (
							<th key={header} scope="col" className={HEAD}>
								{header}
							</th>
						))}
						<th scope="col" className={HEAD}>
							<span className="sr-only">{t("admin.pro.actions")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<ProInterestRow
							key={item.id}
							item={item}
							onToggleContacted={onToggleContacted}
							onDelete={onDelete}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}
