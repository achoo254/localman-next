import {
	DRAFT_MAX_TABS,
	type ImportedData,
	flattenImportedRequests,
} from "@localman/shared/api-client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import {
	CollectionOpenPicker,
	defaultSelection,
} from "./collection-open-picker";
import { ImportDetection } from "./import-detection";
import { ImportSource } from "./import-source";
import { type ImportSelection, toRequestsSelection } from "./open-imported";
import { useImportSource } from "./use-import-source";

export interface ImportModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Picked requests (drafts ready for tabs) or an environment file. */
	onImport: (selection: ImportSelection) => void;
	/** Most requests that may open (tabs left); defaults to the tab cap. */
	maxRequests?: number;
}

/**
 * Import dialog: paste or choose a file, the format is detected as you
 * type, errors say what to fix, and a collection lets you pick which
 * requests to open.
 */
export function ImportModal({
	open,
	onOpenChange,
	onImport,
	maxRequests = DRAFT_MAX_TABS,
}: ImportModalProps) {
	const t = useT();
	const detectionId = useId();
	const source = useImportSource();
	const textBox = useRef<HTMLTextAreaElement>(null);
	const data: ImportedData | null =
		source.parse.state === "parsed" && source.parse.result.ok
			? source.parse.result.value
			: null;
	const requests = useMemo(
		() =>
			data && data.format !== "environment-v21"
				? flattenImportedRequests(data)
				: [],
		[data],
	);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	useEffect(() => {
		setSelected(defaultSelection(requests, maxRequests));
	}, [requests, maxRequests]);

	const changeOpen = (next: boolean): void => {
		if (!next) source.reset();
		onOpenChange(next);
	};
	const submit = (): void => {
		if (!data) return;
		onImport(
			data.format === "environment-v21"
				? { kind: "environment", environment: data }
				: toRequestsSelection(
						data,
						requests.filter((request) => selected.has(request.id)),
					),
		);
		changeOpen(false);
	};
	const isEnvironment = data?.format === "environment-v21";
	const canSubmit = data !== null && (isEnvironment || selected.size > 0);
	// The file is read or the text parsed: the button spins until it can import.
	const processing = source.reading || source.parse.state === "detecting";

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title={t("apiClientTools.import.title")}
			description={t("apiClientTools.import.intro")}
			size="lg"
			initialFocusRef={textBox}
			data-id="modal-import"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-import-submit"
						loading={processing}
						disabled={!canSubmit && !processing}
						onClick={submit}
					>
						{isEnvironment
							? t("apiClientTools.import.submitEnvironment")
							: t("apiClientTools.import.submitRequests", {
									count: selected.size,
								})}
					</Button>
				</ModalFooter>
			}
		>
			<ImportSource
				text={source.text}
				onTextChange={source.changeText}
				file={source.file}
				onFile={(file) => void source.chooseFile(file)}
				onRemoveFile={source.removeFile}
				reading={source.reading}
				describedBy={detectionId}
				textRef={textBox}
			/>
			<ImportDetection id={detectionId} parse={source.parse} />
			{requests.length > 1 ? (
				<CollectionOpenPicker
					requests={requests}
					selected={selected}
					onChange={setSelected}
					max={maxRequests}
				/>
			) : null}
		</Modal>
	);
}
