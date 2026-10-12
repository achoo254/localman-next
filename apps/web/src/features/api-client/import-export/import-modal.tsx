import {
	DRAFT_MAX_TABS,
	type ImportedData,
	flattenImportedRequests,
} from "@localman/shared/api-client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import {
	CollectionOpenPicker,
	defaultSelection,
} from "./collection-open-picker";
import {
	type EnvironmentImport,
	EnvironmentImportNote,
} from "./environment-import-note";
import { ImportDetection } from "./import-detection";
import {
	type CollectionSaveTarget,
	type ImportMode,
	ImportModeChoice,
} from "./import-save-mode";
import { ImportSource } from "./import-source";
import { type ImportSelection, toSelection } from "./open-imported";
import { useImportSource } from "./use-import-source";

export interface ImportModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Picked requests (drafts ready for tabs) or an environment file. */
	onImport: (selection: ImportSelection) => void;
	/** Most requests that may open (tabs left); defaults to the tab cap. */
	maxRequests?: number;
	/** Offers "Save as collection" (workspaces flag on). */
	saveCollection?: CollectionSaveTarget | null;
	/** Choice picked when the dialog opens. */
	initialMode?: ImportMode;
	/**
	 * An environment file can be imported (environments on, the caller may
	 * add to the workspace); otherwise the dialog says why it can't.
	 */
	environmentImport?: EnvironmentImport;
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
	saveCollection = null,
	initialMode = "tabs",
	environmentImport = "unavailable",
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

	const [mode, setMode] = useState<ImportMode>(initialMode);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<unknown>(null);
	useEffect(() => {
		if (open) setMode(initialMode);
	}, [open, initialMode]);
	const saveTarget =
		saveCollection && mode === "collection" ? saveCollection : null;

	const changeOpen = (next: boolean): void => {
		if (saving) return;
		if (!next) {
			source.reset();
			setSaveError(null);
		}
		onOpenChange(next);
	};
	const save = async (target: CollectionSaveTarget): Promise<void> => {
		if (!data || data.format === "environment-v21") return;
		setSaving(true);
		setSaveError(null);
		try {
			await target.save(data);
			setSaving(false);
			changeOpen(false);
		} catch (error) {
			setSaving(false);
			setSaveError(error);
		}
	};
	const submit = (): void => {
		if (!data) return;
		if (saveTarget) {
			void save(saveTarget);
			return;
		}
		const picked = requests.filter((request) => selected.has(request.id));
		onImport(toSelection(data, picked, source.file?.text ?? source.text));
		changeOpen(false);
	};
	const isEnvironment = data?.format === "environment-v21";
	const environmentBlocked = isEnvironment && environmentImport !== "allowed";
	const canSubmit =
		data !== null &&
		!environmentBlocked &&
		(saveTarget ? !isEnvironment : isEnvironment || selected.size > 0);
	// The file is read or the text parsed: the button spins until it can import.
	const processing =
		saving || source.reading || source.parse.state === "detecting";
	let submitLabel = t("apiClientTools.import.submitRequests", {
		count: selected.size,
	});
	if (saveTarget) submitLabel = t("collections.import.submit");
	else if (isEnvironment) {
		submitLabel = t("apiClientTools.import.submitEnvironment");
	}

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
						{submitLabel}
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
			{saveCollection && !isEnvironment ? (
				<ImportModeChoice
					mode={mode}
					onChange={setMode}
					workspaceName={saveCollection.workspaceName}
				/>
			) : null}
			{isEnvironment && environmentImport !== "allowed" ? (
				<EnvironmentImportNote reason={environmentImport} />
			) : null}
			{saveError ? (
				<Alert tone="danger">{errorMessage(saveError)}</Alert>
			) : null}
			{requests.length > 1 && !saveTarget ? (
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
