import {
	VN_FAKE_DATA_COLUMNS,
	type VnFakeDataType,
	type VnFakeRecord,
	type VnFakeRecordOf,
} from "@localman/shared/vn-fake-data";
import { useState } from "react";
import { CodeBlock } from "../../components/ui/code-block";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { useT } from "../../i18n/i18n-context";
import { VnFakeDataActions } from "./vn-fake-data-actions";

type View = "table" | "json";

/** A column of any type: every one has a label under `vnFakeData.columns`. */
type Column = {
	[T in VnFakeDataType]: keyof VnFakeRecordOf[T];
}[VnFakeDataType];

function FakeDataTable({
	type,
	records,
}: {
	type: VnFakeDataType;
	records: readonly VnFakeRecord[];
}) {
	const t = useT();
	const columns: readonly Column[] = VN_FAKE_DATA_COLUMNS[type];
	const cell = (
		record: Readonly<Record<string, string | number>>,
		column: Column,
	) => {
		const value = record[column];
		if (column === "gender" && (value === "male" || value === "female")) {
			return t(`vnFakeData.genders.${value}`);
		}
		return String(value ?? "");
	};
	return (
		<div className="overflow-x-auto rounded-lg border border-border">
			<table
				data-id="vn-fake-data-table"
				className="w-full border-collapse text-left text-xs"
			>
				<caption className="sr-only">
					{t("vnFakeData.preview.caption", { count: records.length })}
				</caption>
				<thead>
					<tr className="bg-surface-subtle text-muted">
						{columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="whitespace-nowrap px-3 py-2 font-semibold"
							>
								{t(`vnFakeData.columns.${column}`)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{records.map((record, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: generated rows have no identity
						<tr key={index} className="border-border-subtle border-t">
							{columns.map((column) => (
								<td
									key={column}
									className="whitespace-nowrap px-3 py-1.5 font-mono"
								>
									{cell(record, column)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Table or JSON view of the records, with copy and download. */
export function VnFakeDataPreview({
	type,
	records,
}: {
	type: VnFakeDataType;
	records: readonly VnFakeRecord[];
}) {
	const t = useT();
	const [view, setView] = useState<View>("table");
	return (
		<section data-id="vn-fake-data-preview" className="grid min-w-0 gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<SegmentedControl
					legend={t("vnFakeData.view.legend")}
					data-id="vn-fake-data-view"
					value={view}
					onChange={setView}
					options={[
						{
							value: "table",
							label: t("vnFakeData.view.table"),
							"data-id": "vn-fake-data-view-table",
						},
						{
							value: "json",
							label: t("vnFakeData.view.json"),
							"data-id": "vn-fake-data-view-json",
						},
					]}
				/>
				<VnFakeDataActions type={type} records={records} />
			</div>
			<p data-id="vn-fake-data-csv-note" className="m-0 text-muted text-sm">
				{t("vnFakeData.actions.csvNote")}
			</p>
			{view === "table" ? (
				<FakeDataTable type={type} records={records} />
			) : (
				<CodeBlock
					caption={t("vnFakeData.preview.caption", { count: records.length })}
					code={JSON.stringify(records, null, 2)}
					data-id="vn-fake-data-json"
				/>
			)}
		</section>
	);
}
