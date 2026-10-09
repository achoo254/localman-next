import type { ProInterestItem } from "./pro-interest-item";
import { ProInterestRow } from "./pro-interest-row";

export interface ProInterestTableProps {
	items: ProInterestItem[];
	/** Row id whose "contacted" change is in flight. */
	pendingId: string | null;
	onToggleContacted: (item: ProInterestItem) => void;
	onDelete: (item: ProInterestItem) => void;
}

const HEAD =
	"whitespace-nowrap border-border border-b px-4 py-3 text-left align-middle font-bold font-mono text-muted text-xs";

export function ProInterestTable({
	items,
	pendingId,
	onToggleContacted,
	onDelete,
}: ProInterestTableProps) {
	return (
		<div className="relative overflow-x-auto" data-id="admin-pro-table-scroll">
			<table
				data-id="admin-pro-table"
				className="w-full min-w-205 border-collapse text-sm"
			>
				<caption className="sr-only">
					Người quan tâm gói Pro, email đã che một phần
				</caption>
				<thead>
					<tr>
						<th scope="col" className={HEAD}>
							Email
						</th>
						<th scope="col" className={HEAD}>
							Nhu cầu
						</th>
						<th scope="col" className={HEAD}>
							Quy mô
						</th>
						<th scope="col" className={HEAD}>
							Nguồn
						</th>
						<th scope="col" className={HEAD}>
							Ngày
						</th>
						<th scope="col" className={HEAD}>
							Trạng thái
						</th>
						<th scope="col" className={HEAD}>
							<span className="sr-only">Thao tác</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<ProInterestRow
							key={item.id}
							item={item}
							pending={pendingId === item.id}
							onToggleContacted={onToggleContacted}
							onDelete={onDelete}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}
