import { IconFileUpload, IconX } from "@tabler/icons-react";
import type { Ref } from "react";
import { buttonClassName } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
import { IconButton } from "../../../components/ui/icon-button";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { formatBytes } from "../response/response-content";

export interface ImportSourceProps {
	text: string;
	onTextChange: (text: string) => void;
	/** A chosen file replaces the pasted text until it is removed. */
	file: { name: string; size: number } | null;
	onFile: (file: File) => void;
	onRemoveFile: () => void;
	reading: boolean;
	/** Id of the detection line, read with the field. */
	describedBy: string;
	/** The paste box, focused when the dialog opens. */
	textRef?: Ref<HTMLTextAreaElement>;
}

const ACCEPT = ".json,.txt,.sh,.curl,.yaml,.yml,application/json,text/plain";

/** Paste box or file chooser of the import dialog. */
export function ImportSource({
	text,
	onTextChange,
	file,
	onFile,
	onRemoveFile,
	reading,
	describedBy,
	textRef,
}: ImportSourceProps) {
	const { t, formatNumber } = useI18n();
	return (
		<div className="grid gap-3">
			{file ? (
				<div
					data-id="modal-import-file-chip"
					className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-1 font-mono text-[0.8125rem]"
				>
					<span className="min-w-0 flex-1 truncate">
						{t("apiClientTools.import.fileChosen", {
							name: file.name,
							size: formatBytes(file.size, formatNumber),
						})}
					</span>
					<IconButton
						size="sm"
						label={t("apiClientTools.import.removeFile", { name: file.name })}
						icon={<IconX size={16} aria-hidden="true" />}
						data-id="modal-import-file-remove"
						onClick={onRemoveFile}
					/>
				</div>
			) : (
				<FormField label={t("apiClientTools.import.text")}>
					<Textarea
						ref={textRef}
						value={text}
						placeholder={t("apiClientTools.import.placeholder")}
						data-id="modal-import-text"
						aria-describedby={describedBy}
						spellCheck={false}
						className="min-h-40 text-xs"
						onChange={(event) => onTextChange(event.target.value)}
					/>
				</FormField>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<label
					className={cn(
						buttonClassName({ size: "sm" }),
						"focus-within:shadow-focus-primary",
					)}
				>
					<IconFileUpload size={16} aria-hidden="true" />
					{t("apiClientTools.import.chooseFile")}
					<input
						type="file"
						accept={ACCEPT}
						data-id="modal-import-file"
						aria-describedby={describedBy}
						className="sr-only"
						onChange={(event) => {
							const [chosen] = event.target.files ?? [];
							if (chosen) onFile(chosen);
							event.target.value = "";
						}}
					/>
				</label>
				{reading ? (
					<output className="text-muted text-sm">
						{t("apiClientTools.import.reading")}
					</output>
				) : null}
			</div>
		</div>
	);
}
