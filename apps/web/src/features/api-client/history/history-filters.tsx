import { HTTP_METHODS, type HttpMethod } from "@localman/shared/api-client";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useT } from "../../../i18n/i18n-context";

export type HistoryMethodFilter = HttpMethod | "ALL";

export interface HistoryFiltersProps {
	query: string;
	method: HistoryMethodFilter;
	onQueryChange: (query: string) => void;
	onMethodChange: (method: HistoryMethodFilter) => void;
}

const isMethod = (value: string): value is HttpMethod =>
	HTTP_METHODS.some((method) => method === value);

/** Search box and method filter above the history list. */
export function HistoryFilters({
	query,
	method,
	onQueryChange,
	onMethodChange,
}: HistoryFiltersProps) {
	const t = useT();
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-2">
			<Input
				type="search"
				value={query}
				aria-label={t("apiClientTools.history.search")}
				placeholder={t("apiClientTools.history.searchPlaceholder")}
				data-id="sidebar-history-search"
				className="min-h-9 text-xs"
				onChange={(event) => onQueryChange(event.target.value)}
			/>
			<Select
				value={method}
				aria-label={t("apiClientTools.history.method")}
				data-id="sidebar-history-method"
				className="min-h-9 text-xs"
				onChange={(event) => {
					const next = event.target.value;
					onMethodChange(isMethod(next) ? next : "ALL");
				}}
			>
				<option value="ALL">{t("apiClientTools.history.allMethods")}</option>
				{HTTP_METHODS.map((m) => (
					<option key={m} value={m}>
						{m}
					</option>
				))}
			</Select>
		</div>
	);
}
