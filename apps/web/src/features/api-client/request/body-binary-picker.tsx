import type { FileRef } from "@localman/shared/api-client";
import { IconUpload } from "@tabler/icons-react";
import { useState } from "react";
import { buttonClassName } from "../../../components/ui/button";
import { useI18n, useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { fileRefOf, isFileTooLarge } from "../../../platform/file-read";
import { newId } from "../workbench/workbench-ids";

export interface FilePickerProps {
	/** The file chosen so far (its bytes may be gone after a reload). */
	value: FileRef | null;
	/** Whether this tab still holds the bytes behind `value`. */
	hasBytes: boolean;
	/** New reference and its file; the caller forgets the old bytes. */
	onPick: (ref: FileRef, file: File) => void;
	/** Accessible name of the picker ("Body file", "File of avatar"). */
	label: string;
	compact?: boolean;
	"data-id"?: string;
}

/** File chooser for a body or a form-data row; bytes stay in the tab. */
export function FilePicker({
	value,
	hasBytes,
	onPick,
	label,
	compact = false,
	"data-id": dataId,
}: FilePickerProps) {
	const t = useT();
	const { formatNumber } = useI18n();
	const [tooLarge, setTooLarge] = useState(false);
	return (
		<div className="grid gap-1">
			<label
				data-id={dataId}
				className={cn(
					buttonClassName({ variant: "secondary", size: "sm" }),
					"max-w-full justify-start focus-within:shadow-focus-primary",
					compact ? "min-h-9" : "min-h-11",
				)}
			>
				<IconUpload size={14} aria-hidden="true" />
				<span className="truncate">
					{value ? value.name : t("apiClient.body.chooseFile")}
				</span>
				<input
					type="file"
					aria-label={label}
					className="sr-only"
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (!file) return;
						const large = isFileTooLarge(file);
						setTooLarge(large);
						if (!large) onPick(fileRefOf(file, newId()), file);
					}}
				/>
			</label>
			{tooLarge ? (
				<p role="alert" className="text-error-text text-xs">
					{t("apiClient.body.fileTooLarge")}
				</p>
			) : value && !hasBytes ? (
				<p className="text-warning-text text-xs">
					{t("apiClient.body.fileAgain")}
				</p>
			) : value && !compact ? (
				<p className="text-muted text-xs">
					{t("apiClient.body.fileSize", { size: formatNumber(value.size) })}
				</p>
			) : null}
		</div>
	);
}
