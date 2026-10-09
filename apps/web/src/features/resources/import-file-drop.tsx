import { IconFileUpload, IconX } from "@tabler/icons-react";
import { type DragEvent, useId, useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { type ImportFile, kilobytes } from "./import-source";

export interface ImportFileDropProps {
	file: ImportFile | null;
	reading: boolean;
	onFile: (file: File) => void;
	onRemove: () => void;
	/** Id of the error under the tabs, when there is one. */
	errorId: string | undefined;
}

/**
 * Choose or drop one CSV/JSON file: a dashed label around a hidden file
 * input (so it opens with Enter/Space like a button), then a chip.
 */
export function ImportFileDrop({
	file,
	reading,
	onFile,
	onRemove,
	errorId,
}: ImportFileDropProps) {
	const t = useT();
	const inputId = useId();
	const [over, setOver] = useState(false);

	function drop(event: DragEvent) {
		event.preventDefault();
		setOver(false);
		const [dropped] = event.dataTransfer.files;
		if (dropped) onFile(dropped);
	}

	return (
		<div className="grid gap-3" data-id="resource-import-file">
			{file ? (
				<div className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-1 font-mono text-[0.8125rem]">
					<span className="min-w-0 flex-1 truncate">
						{t("resourceImport.file.chosen", {
							name: file.name,
							size: kilobytes(file.size),
						})}
					</span>
					<IconButton
						size="sm"
						label={t("resourceImport.file.remove")}
						icon={<IconX size={16} aria-hidden="true" />}
						data-id="resource-import-file-remove"
						onClick={onRemove}
					/>
				</div>
			) : (
				<label
					htmlFor={inputId}
					onDragOver={(event) => {
						event.preventDefault();
						setOver(true);
					}}
					onDragLeave={() => setOver(false)}
					onDrop={drop}
					className={cn(
						"grid cursor-pointer justify-items-center gap-2 rounded-lg border border-dashed p-6 text-center",
						"focus-within:border-primary focus-within:shadow-focus-primary",
						over ? "border-primary" : "border-border",
					)}
				>
					<IconFileUpload
						size={28}
						aria-hidden="true"
						className="text-icon-muted"
					/>
					<span className="font-mono font-semibold text-sm">
						{t("resourceImport.file.choose")}
					</span>
					<span className="text-muted text-xs">
						{t("resourceImport.file.drop")}
					</span>
					<input
						id={inputId}
						type="file"
						accept=".csv,.json,text/csv,application/json"
						aria-describedby={errorId}
						className="sr-only"
						onChange={(event) => {
							const [chosen] = event.target.files ?? [];
							if (chosen) onFile(chosen);
							event.target.value = "";
						}}
					/>
				</label>
			)}
			{reading ? (
				<output className="block text-muted text-sm">
					{t("resourceImport.file.reading")}
				</output>
			) : null}
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("resourceImport.file.hint")}
			</p>
		</div>
	);
}
