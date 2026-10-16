import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";

export interface KeyValueTableHeadProps {
	/** Cell classes shared with the body. */
	cell: string;
	/** Header of the extra column after Key, if any. */
	typeHeader?: string;
	withDescription: boolean;
}

/** Column headers of `KeyValueTable`. */
export function KeyValueTableHead({
	cell,
	typeHeader,
	withDescription,
}: KeyValueTableHeadProps) {
	const t = useT();
	return (
		<thead>
			<tr className="text-left text-muted text-xs">
				<th scope="col" className={cn(cell, "w-10")}>
					<span className="sr-only">{t("apiClient.table.enabled")}</span>
				</th>
				<th scope="col" className={cn(cell, "font-semibold")}>
					{t("apiClient.table.key")}
				</th>
				{typeHeader !== undefined ? (
					<th scope="col" className={cn(cell, "w-28 font-semibold")}>
						{typeHeader}
					</th>
				) : null}
				<th scope="col" className={cn(cell, "font-semibold")}>
					{t("apiClient.table.value")}
				</th>
				{withDescription ? (
					<th scope="col" className={cn(cell, "font-semibold max-md:hidden")}>
						{t("apiClient.table.description")}
					</th>
				) : null}
				<th scope="col" className={cn(cell, "w-10")}>
					<span className="sr-only">{t("apiClient.table.actions")}</span>
				</th>
			</tr>
		</thead>
	);
}
