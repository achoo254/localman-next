import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import {
	FILTER_METHODS,
	FILTER_STATUSES,
	type LogFilters,
	MAX_PATH_FILTER,
	NO_FILTERS,
	filtersActive,
} from "./log-filters";
import { LOG_SOURCES, isLogSource } from "./request-log-parse";

/** Typing in "Path contains" applies after this pause. */
export const PATH_DEBOUNCE_MS = 300;

export interface RequestLogFiltersProps {
	filters: LogFilters;
	onChange: (filters: LogFilters) => void;
}

/** Method, status class, source and path filters of the request log. */
export function RequestLogFilters({
	filters,
	onChange,
}: RequestLogFiltersProps) {
	const t = useT();
	const [path, setPath] = useState(filters.path);

	// "Clear filters" elsewhere (empty table) resets the typed path too.
	useEffect(() => setPath(filters.path), [filters.path]);

	useEffect(() => {
		if (path === filters.path) return;
		const timer = window.setTimeout(
			() => onChange({ ...filters, path }),
			PATH_DEBOUNCE_MS,
		);
		return () => window.clearTimeout(timer);
	}, [path, filters, onChange]);

	const all = <option value="">{t("common.all")}</option>;
	return (
		<div
			// biome-ignore lint/a11y/useSemanticElements: <search> is unknown to Safari 16 and jsdom; the role gives the same landmark everywhere.
			role="search"
			aria-label={t("trafficLog.filters.label")}
			data-id="request-log-filters"
			className="grid grid-cols-2 items-end gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)_auto]"
		>
			<FormField label={t("trafficLog.filters.method")}>
				<Select
					value={filters.method}
					onChange={(event) =>
						onChange({ ...filters, method: event.target.value })
					}
					data-id="request-log-filter-method"
				>
					{all}
					{FILTER_METHODS.map((method) => (
						<option key={method} value={method}>
							{method}
						</option>
					))}
				</Select>
			</FormField>
			<FormField label={t("trafficLog.filters.status")}>
				<Select
					value={filters.status}
					onChange={(event) =>
						onChange({ ...filters, status: event.target.value })
					}
					data-id="request-log-filter-status"
				>
					{all}
					{FILTER_STATUSES.map((status) => (
						<option key={status} value={status}>
							{status}
						</option>
					))}
				</Select>
			</FormField>
			<FormField label={t("trafficLog.filters.source")}>
				<Select
					value={filters.source}
					onChange={(event) => {
						const value = event.target.value;
						onChange({ ...filters, source: isLogSource(value) ? value : "" });
					}}
					data-id="request-log-filter-source"
				>
					{all}
					{LOG_SOURCES.map((source) => (
						<option key={source} value={source}>
							{t(`trafficLog.sources.${source}`)}
						</option>
					))}
				</Select>
			</FormField>
			<FormField label={t("trafficLog.filters.path")}>
				<Input
					type="search"
					placeholder="/orders"
					maxLength={MAX_PATH_FILTER}
					value={path}
					onChange={(event) => setPath(event.target.value)}
					data-id="request-log-filter-path"
				/>
			</FormField>
			<Button
				variant="ghost"
				size="sm"
				className="mb-1.5"
				disabled={!filtersActive({ ...filters, path })}
				onClick={() => {
					setPath("");
					onChange(NO_FILTERS);
				}}
				data-id="request-log-filter-clear"
			>
				{t("trafficLog.filters.clear")}
			</Button>
		</div>
	);
}
