import type { FormDataRow } from "@localman/shared/api-client";
import { useT } from "../../../i18n/i18n-context";
import { FilePicker } from "./body-binary-picker";
import type { BodyFilesProps } from "./body-files";
import { newFormDataRow } from "./draft-pane";
import { KeyValueTable } from "./key-value-table";

export interface BodyFormTableProps extends BodyFilesProps {
	rows: readonly FormDataRow[];
	onChange: (rows: FormDataRow[]) => void;
}

/** multipart/form-data rows: text values or picked files. */
export function BodyFormTable({
	rows,
	onChange,
	files,
	setFile,
}: BodyFormTableProps) {
	const t = useT();
	const forget = (row: FormDataRow) => {
		if (row.file) setFile(row.file.fileId, null);
	};
	return (
		<KeyValueTable<FormDataRow>
			rows={rows}
			onChange={(next) => {
				// Bytes of removed file rows are dropped with them.
				for (const row of rows) {
					if (!next.some((item) => item.id === row.id)) forget(row);
				}
				onChange(next);
			}}
			createRow={newFormDataRow}
			dataId="request-body"
			tableDataId="request-body-formData"
			caption={t("apiClient.body.types.formdata")}
			addLabel={t("apiClient.body.addRow")}
			typeColumn={{
				header: t("apiClient.body.kind"),
				render: (row, update) => (
					<select
						value={row.kind}
						aria-label={t("apiClient.body.kindOf", { name: row.key || "-" })}
						className="min-h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm"
						onChange={(event) => {
							const kind = event.target.value === "file" ? "file" : "text";
							if (kind === row.kind) return;
							forget(row);
							update({ ...row, kind, value: "", file: undefined });
						}}
					>
						<option value="text">{t("apiClient.body.kinds.text")}</option>
						<option value="file">{t("apiClient.body.kinds.file")}</option>
					</select>
				),
			}}
			renderValue={(row, update) =>
				row.kind === "file" ? (
					<FilePicker
						compact
						value={row.file ?? null}
						hasBytes={row.file ? files.has(row.file.fileId) : false}
						label={t("apiClient.body.fileOf", { name: row.key || "-" })}
						data-id="request-body-file"
						onPick={(ref, file) => {
							forget(row);
							setFile(ref.fileId, file);
							update({ ...row, file: ref });
						}}
					/>
				) : null
			}
		/>
	);
}
