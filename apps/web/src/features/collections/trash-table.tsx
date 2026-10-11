import { IconRestore, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { TrashedCollection } from "./collection-parsers";
import { TRASH_WARNING_DAYS, daysLeft } from "./use-trash";

export interface TrashTableProps {
	items: readonly TrashedCollection[];
	now: Date;
	onRestore: (item: TrashedCollection) => void;
	onDelete: (item: TrashedCollection) => void;
}

const TH =
	"whitespace-nowrap border-border border-b p-3 text-left font-mono font-semibold text-muted text-xs uppercase tracking-wide";
const TD = "p-3 align-middle max-md:p-0";

/** Field name shown above a value when the rows become cards (below 768px). */
function CardLabel({ children }: { children: ReactNode }) {
	return <span className="text-muted md:hidden">{children}: </span>;
}

/** Deleted collections: a table from 768px, a list of cards below. */
export function TrashTable({
	items,
	now,
	onRestore,
	onDelete,
}: TrashTableProps) {
	const { t, formatDate } = useI18n();
	return (
		<div className={cn(cardClassName, "overflow-hidden")}>
			<table
				data-id="trash-table"
				className="w-full border-collapse text-[0.8125rem] max-md:block"
			>
				<caption className="sr-only">{t("collections.trash.table")}</caption>
				<thead className="max-md:hidden">
					<tr>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.name")}
						</th>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.type")}
						</th>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.workspace")}
						</th>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.deletedBy")}
						</th>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.deletedAt")}
						</th>
						<th scope="col" className={TH}>
							{t("collections.trash.columns.daysLeft")}
						</th>
						<th scope="col" className={TH}>
							<span className="sr-only">
								{t("collections.trash.columns.actions")}
							</span>
						</th>
					</tr>
				</thead>
				<tbody className="max-md:block">
					{items.map((item) => {
						const left = daysLeft(item.purgeAt, now);
						return (
							<tr
								key={item.id}
								data-id="trash-item"
								className="border-border-subtle border-b last:border-b-0 max-md:grid max-md:gap-1 max-md:p-3"
							>
								<td className={cn(TD, "min-w-0 break-words")}>
									<span className="block font-bold font-mono">{item.name}</span>
									<span
										data-id="trash-item-count"
										className="block text-muted text-xs"
									>
										{t("collections.trash.items", { count: item.requestCount })}
									</span>
								</td>
								<td className={TD}>
									<Badge tone="neutral">
										{t("collections.trash.typeCollection")}
									</Badge>
								</td>
								<td className={TD}>
									<CardLabel>
										{t("collections.trash.columns.workspace")}
									</CardLabel>
									{item.workspaceName ?? (
										<span className="text-muted">
											{t("collections.trash.deletedWorkspace")}
										</span>
									)}
								</td>
								<td className={TD}>
									<CardLabel>
										{t("collections.trash.columns.deletedBy")}
									</CardLabel>
									{item.deletedByName ?? t("collections.trash.removedAccount")}
								</td>
								<td className={cn(TD, "whitespace-nowrap font-mono text-xs")}>
									<CardLabel>
										{t("collections.trash.columns.deletedAt")}
									</CardLabel>
									{formatDate(item.deletedAt)}
								</td>
								<td
									data-id="trash-item-days"
									className={cn(
										TD,
										"whitespace-nowrap font-mono text-xs",
										left <= TRASH_WARNING_DAYS &&
											"font-semibold text-warning-text",
									)}
								>
									<CardLabel>
										{t("collections.trash.columns.daysLeft")}
									</CardLabel>
									{t("collections.trash.daysLeft", { count: left })}
								</td>
								<td className={TD}>
									<div className="flex flex-wrap justify-end gap-1 max-md:justify-start max-md:pt-1">
										<Button
											size="sm"
											variant="secondary"
											data-id="trash-restore"
											aria-label={t("collections.trash.restoreLabel", {
												name: item.name,
											})}
											onClick={() => onRestore(item)}
										>
											<IconRestore size={14} aria-hidden="true" />
											{t("collections.trash.restore")}
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="text-error-text"
											data-id="trash-delete-permanently"
											aria-label={t("collections.trash.deleteLabel", {
												name: item.name,
											})}
											onClick={() => onDelete(item)}
										>
											<IconTrash size={14} aria-hidden="true" />
											{t("collections.trash.deletePermanently")}
										</Button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
