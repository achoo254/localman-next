import { useMemo } from "react";
import { useT } from "../../../i18n/i18n-context";
import { isRecord } from "../../../lib/json-guards";

/** Rows rendered at most; a 10 MB array would otherwise freeze the tab. */
export const MAX_PREVIEW_ROWS = 200;
/** Columns taken from the keys of the first rows. */
const MAX_PREVIEW_COLUMNS = 30;

interface TableData {
	columns: string[];
	rows: Record<string, unknown>[];
	total: number;
}

/** An array of objects, or one object, as table rows; else nothing. */
export function toTableData(value: unknown): TableData | null {
	const list = Array.isArray(value) ? value : [value];
	const rows = list.filter(isRecord);
	if (rows.length === 0) return null;
	const columns: string[] = [];
	for (const row of rows.slice(0, MAX_PREVIEW_ROWS)) {
		for (const key of Object.keys(row)) {
			if (columns.length >= MAX_PREVIEW_COLUMNS) break;
			if (!columns.includes(key)) columns.push(key);
		}
	}
	return {
		columns,
		rows: rows.slice(0, MAX_PREVIEW_ROWS),
		total: rows.length,
	};
}

function cellText(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;
	return JSON.stringify(value) ?? "";
}

/** JSON body as a table, like the Preview of the prototype. */
export function JsonTablePreview({ json }: { json: string }) {
	const t = useT();
	const data = useMemo(() => {
		try {
			return toTableData(JSON.parse(json));
		} catch {
			return null;
		}
	}, [json]);

	if (!data) {
		return (
			<p data-id="response-body-preview" className="m-0 p-4 text-muted text-sm">
				{t("apiClientTools.response.body.previewJsonEmpty")}
			</p>
		);
	}
	const caption =
		data.total > data.rows.length
			? t("apiClientTools.response.body.previewJsonCapped", {
					count: data.rows.length,
					total: data.total,
				})
			: t("apiClientTools.response.body.previewJsonRows", {
					count: data.rows.length,
				});
	return (
		<div
			data-id="response-body-preview"
			className="min-h-0 flex-1 overflow-auto p-4"
		>
			<table className="w-full border-collapse font-mono text-xs">
				<caption className="pb-2 text-left text-muted">{caption}</caption>
				<thead>
					<tr>
						{data.columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="border border-border-subtle bg-surface-subtle px-2 py-1.5 text-left font-semibold"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.rows.map((row, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are a read-only snapshot.
						<tr key={index}>
							{data.columns.map((column) => (
								<td
									key={column}
									className="max-w-80 truncate border border-border-subtle px-2 py-1.5 align-top"
								>
									{cellText(row[column])}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
